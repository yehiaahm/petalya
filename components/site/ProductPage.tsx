'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Cake, Copy, Info, ShareNetwork, ShoppingBagOpen, WhatsappLogo } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { MiniHeader } from './Checkout';
import { Price, QtyControl } from './Menu';
import { FwdIcon } from './Chrome';

export function ProductPage({ id }: { id: string }) {
  const { data, t, pick, count, toast } = useSite();
  const p = data.products.find((x) => x.id === id);
  const [idx, setIdx] = useState(0);
  if (!p) return null;

  const cat = data.categories.find((c) => c.id === p.categoryId);
  const related = data.products.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 4);
  const imgs = p.images;
  const shareText = `${t(p.name)} — Petalya`;
  const url = () => (typeof location !== 'undefined' ? location.href : '');

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: shareText, url: url() });
      else await copy();
    } catch {}
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      toast(pick('اتنسخ اللينك', 'Link copied'));
    } catch {}
  };

  return (
    <div className="page-bg">
      <MiniHeader back="/#menu" backLabel={pick('المنيو', 'Menu')} />
      <main className="wrap" style={{ maxWidth: 1080, padding: 'clamp(20px,4vw,40px) clamp(16px,4vw,48px) 120px' }}>
        <div className="pp">
          <div className="pp-media">
            <div className="pp-main">{imgs[idx] ? <img className="cover" src={imgs[idx]} alt={t(p.name)} /> : <Cake size={80} weight="light" />}</div>
            {imgs.length > 1 && (
              <div className="pp-thumbs">
                {imgs.map((src, i) => (
                  <button key={src} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} aria-label={`${i + 1}`}>
                    <img className="cover" src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pp-info">
            {cat && <span className="eyebrow">{t(cat.name)}</span>}
            <h1 className="pp-title">{t(p.name)}</h1>
            <p className="pp-desc">{t(p.desc)}</p>
            <div className="pp-buy">
              <span style={{ fontSize: 22 }}>
                <Price p={p} />
              </span>
              <QtyControl product={p} light />
            </div>
            {count > 0 && (
              <Link href="/checkout" className="btn btn-flat btn-md" data-burst="1" style={{ alignSelf: 'flex-start' }}>
                <ShoppingBagOpen size={20} />
                {pick('أكمل الطلب', 'Go to checkout')}
                <FwdIcon size={17} />
              </Link>
            )}
            {p.leadDays ? (
              <p className="menu-note" style={{ justifyContent: 'flex-start', textAlign: 'start', margin: 0 }}>
                <Info size={16} color="#B97E5E" style={{ flex: 'none' }} />
                {pick(`اطلبها قبل ميعادك بـ ${p.leadDays} أيام على الأقل.`, `Order at least ${p.leadDays} days ahead.`)}
              </p>
            ) : null}
            <div className="pp-share">
              <button className="btn btn-outline btn-sm" onClick={share}>
                <ShareNetwork size={18} />
                {pick('شارك', 'Share')}
              </button>
              <button className="btn btn-outline btn-sm" onClick={copy}>
                <Copy size={18} />
                {pick('انسخ اللينك', 'Copy link')}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url())}`, '_blank', 'noopener')}>
                <WhatsappLogo size={18} />
                {pick('ابعتها لحد', 'Send to a friend')}
              </button>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section style={{ marginTop: 'clamp(48px,8vw,80px)' }}>
            <h2 className="card-title" style={{ justifyContent: 'center', marginBottom: 20 }}>
              {pick('كمان ممكن يعجبك', 'You may also like')}
            </h2>
            <div className="pp-related">
              {related.map((r) => (
                <Link key={r.id} href={`/p/${r.id}`} className="pp-rel">
                  <span className="im">{r.images[0] ? <img className="cover" src={r.images[0]} alt="" loading="lazy" /> : <Cake size={34} weight="light" />}</span>
                  <span className="nm">{t(r.name)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="center" style={{ marginTop: 40, fontSize: 14 }}>
          <Link href="/#custom">{pick('عايز تصميم مخصوص؟ صمّم تورتتك', 'Want something custom? Design your cake')}</Link>
        </p>
      </main>
    </div>
  );
}
