'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Cake, Images, Info, Minus, Plus, X } from '@phosphor-icons/react';
import type { Product } from '@/lib/types';
import { useSite } from './SiteProvider';
import { arCount } from '@/lib/ar';

export function QtyControl({ product, light = false }: { product: Product; light?: boolean }) {
  const { qtyOf, add, dec, pick } = useSite();
  const q = qtyOf(product.id);
  if (product.soldOut) return <span className="soldout">{pick('نفدت الكمية', 'Sold out')}</span>;
  if (!q)
    return (
      <button className="add-btn" data-burst="1" onClick={() => add(product.id)} aria-label={pick('أضف إلى الطلب', 'Add to order')}>
        <Plus size={16} weight="bold" />
      </button>
    );
  return (
    <div className={'stepper' + (light ? ' light' : '')}>
      <button onClick={() => dec(product.id)} aria-label="-">
        <Minus size={14} weight="bold" />
      </button>
      <span aria-live="polite">{q}</span>
      <button className="plus" data-burst="1" onClick={() => add(product.id)} aria-label="+">
        <Plus size={14} weight="bold" />
      </button>
    </div>
  );
}

export function Price({ p }: { p: Product }) {
  const { fmt, showPrices } = useSite();
  if (!showPrices) return null;
  return (
    <span className="price">
      {fmt(p.price)}
      {p.compareAt && p.compareAt > p.price ? <s>{fmt(p.compareAt)}</s> : null}
    </span>
  );
}

export function Menu({ tab, setTab }: { tab: number; setTab: (i: number) => void }) {
  const { t, pick, ar, data, reduced, showPrices } = useSite();
  const [sheet, setSheet] = useState<Product | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const cats = data.categories.filter((c) => data.products.some((p) => p.categoryId === c.id));
  const cat = cats[Math.min(tab, cats.length - 1)];
  const items = cat ? data.products.filter((p) => p.categoryId === cat.id) : [];

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced || !gridRef.current) return;
    Array.from(gridRef.current.children).forEach((el, i) =>
      (el as HTMLElement).animate([{ opacity: 0, translate: '0 18px' }, { opacity: 1, translate: '0 0' }], { duration: 520, delay: i * 70, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }),
    );
  }, [tab, reduced]);

  const n = Math.max(1, cats.length);
  const onKey = (e: React.KeyboardEvent) => {
    const fwd = ar ? 'ArrowLeft' : 'ArrowRight', back = ar ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === fwd) setTab((tab + 1) % n);
    if (e.key === back) setTab((tab - 1 + n) % n);
  };

  return (
    <section id="menu" className="section menu-section">
      <div className="scallop top" style={{ ['--sc' as string]: '#FBF5EE' }} aria-hidden="true" />
      <div className="scallop bottom" style={{ ['--sc' as string]: '#2B1B16' }} aria-hidden="true" />
      <div className="wrap w1080">
        <div className="center">
          <div data-reveal="1" className="eyebrow">
            <span>{pick('المنيو', 'The menu')}</span>
          </div>
          <h2 data-reveal="1" className="h2">
            {ar ? (
              <>
                اختر <span className="accent">حلاوتك</span>
              </>
            ) : (
              <>
                Choose your <em className="accent">sweet</em>
              </>
            )}
          </h2>
        </div>
        {cats.length > 1 && (
          <div role="tablist" className="tabs" onKeyDown={onKey} style={{ width: `min(100%, ${Math.max(420, cats.length * 140)}px)` }}>
            <span className="slider" style={{ width: `calc((100% - 10px) / ${n})`, insetInlineStart: `calc(5px + ${tab} * (100% - 10px) / ${n})` }} />
            {cats.map((c, i) => (
              <button key={c.id} role="tab" aria-selected={tab === i} tabIndex={tab === i ? 0 : -1} data-burst="1" onClick={() => setTab(i)}>
                {t(c.name)}
              </button>
            ))}
          </div>
        )}
        <div ref={gridRef} className="menu-grid" role="tabpanel">
          {items.map((it) => (
            <div key={it.id} className="menu-card">
              <button className="thumb" onClick={() => setSheet(it)} aria-label={t(it.name)}>
                {it.images[0] ? <img className="cover" src={it.images[0]} alt="" loading="lazy" /> : <Cake size={34} weight="light" />}
                {it.images.length > 1 && (
                  <span className="more">
                    <Images size={12} />
                    {it.images.length}
                  </span>
                )}
              </button>
              <div className="body">
                <button className="name" onClick={() => setSheet(it)}>
                  {t(it.name)}
                </button>
                <span className="desc">{t(it.desc)}</span>
                <div className="foot">
                  <Price p={it} />
                  <QtyControl product={it} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {showPrices && (
          <p className="menu-note">
            <Info size={16} color="#B97E5E" style={{ flex: 'none' }} />
            {pick('الأسعار المعروضة أسعار مبدئية، ويُحدَّد السعر النهائي حسب التصميم والحجم.', 'Prices are starting points — the final quote depends on design and size.')}
          </p>
        )}
      </div>
      <ProductSheet product={sheet} onClose={() => setSheet(null)} />
    </section>
  );
}

export function ProductSheet({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t, pick } = useSite();
  const [shown, setShown] = useState<Product | null>(null);
  const [idx, setIdx] = useState(0);
  const slides = useRef<HTMLDivElement>(null);
  const open = !!product;

  useEffect(() => {
    if (product) {
      setShown(product);
      setIdx(0);
      slides.current?.scrollTo({ left: 0 });
    }
  }, [product]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);

  const p = shown;
  const go = (i: number) => {
    const el = slides.current;
    if (!el) return;
    setIdx(i);
    el.children[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
  const onScroll = () => {
    const el = slides.current;
    if (!el) return;
    setIdx(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  };

  return (
    <>
      <div className={'sheet-backdrop' + (open ? ' open' : '')} onClick={onClose} />
      <div className={'sheet' + (open ? ' open' : '')} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={p ? t(p.name) : ''}>
        {p && (
          <>
            <div className="media">
              <button className="icon-btn close" onClick={onClose} aria-label={pick('إغلاق', 'Close')} tabIndex={open ? 0 : -1}>
                <X size={20} />
              </button>
              <div className="slides" ref={slides} onScroll={onScroll}>
                {p.images.length ? (
                  p.images.map((src, i) => <img key={src + i} className="cover" src={src} alt="" />)
                ) : (
                  <div style={{ display: 'grid', placeItems: 'center', color: '#B97E5E' }}>
                    <Cake size={80} weight="light" />
                  </div>
                )}
              </div>
            </div>
            {p.images.length > 1 && (
              <div className="thumbs">
                {p.images.map((src, i) => (
                  <button key={src + i} className={i === idx ? 'on' : ''} onClick={() => go(i)} aria-label={`${i + 1}`} tabIndex={open ? 0 : -1}>
                    <img className="cover" src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
            <div className="content">
              <h3>{t(p.name)}</h3>
              <p style={{ margin: 0, color: 'var(--ink-muted)', lineHeight: 1.75 }}>{t(p.desc)}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 20 }}>
                  <Price p={p} />
                </span>
                <QtyControl product={p} light />
              </div>
              <Link href={`/p/${p.id}`} className="pp-link" onClick={onClose}>
                {pick('افتح صفحة المنتج وشاركها', 'Open product page & share')}
              </Link>
              {p.leadDays ? (
                <p className="menu-note" style={{ justifyContent: 'flex-start', marginTop: 8, textAlign: 'start' }}>
                  <Info size={16} color="#B97E5E" style={{ flex: 'none' }} />
                  {pick(`اطلبها قبل موعدك بـ ${arCount(p.leadDays, 'day')} على الأقل.`, `Order at least ${p.leadDays} days ahead.`)}
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </>
  );
}
