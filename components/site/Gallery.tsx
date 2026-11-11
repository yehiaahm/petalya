'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, InstagramLogo, ShoppingBagOpen } from '@phosphor-icons/react';
import type { GalleryItem } from '@/lib/types';
import { useSite } from './SiteProvider';
import { BackIcon, FwdIcon, scrollToId } from './Chrome';
import { loopWhileVisible, prefersReduced } from '@/lib/petals';

export function Gallery({ items }: { items: GalleryItem[] }) {
  const { t, pick, ar, data, track, add, toast, reduced } = useSite();
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const scRef = useRef<HTMLDivElement>(null);
  const vel = useRef(0);
  const last = useRef<{ x: number; t: number } | null>(null);

  useEffect(() => {
    const el = scRef.current!;
    if (prefersReduced()) return;
    const swing: { a: number; w: number }[] = [];
    const cards = () => Array.from(el.querySelectorAll<HTMLElement>('[data-swing]'));
    let els = cards();
    const mo = new MutationObserver(() => (els = cards()));
    mo.observe(el, { childList: true, subtree: true });
    const stop = loopWhileVisible(el, (time) => {
      const v = vel.current;
      vel.current *= 0.85;
      els.forEach((c, i) => {
        const s = swing[i] || (swing[i] = { a: 0, w: 0 });
        const target = Math.sin(time / 1300 + i * 1.7) * 1.1;
        s.w += (target - s.a) * 0.02 - s.w * 0.06 - v * 0.012;
        s.a = Math.max(-16, Math.min(16, s.a + s.w));
        c.style.transform = `rotate(${s.a.toFixed(2)}deg)`;
      });
    });
    return () => {
      stop();
      mo.disconnect();
    };
  }, []);

  const onScroll = () => {
    const el = scRef.current!;
    const x = el.scrollLeft, now = performance.now();
    if (last.current) vel.current += ((x - last.current.x) / Math.max(8, now - last.current.t)) * 16;
    last.current = { x, t: now };
  };
  const by = (dir: number) => {
    const el = scRef.current!;
    const c = el.querySelector('[data-swing]');
    const w = c ? c.getBoundingClientRect().width + 26 : 260;
    el.scrollBy({ left: dir * w * (ar ? -1 : 1), behavior: 'smooth' });
  };

  if (!items.length) return null;

  return (
    <section id="work" className="section" style={{ padding: 'clamp(96px,14vw,160px) 0 clamp(64px,9vw,110px)' }}>
      <div className="wrap w1240 center">
        <div data-reveal="1" className="eyebrow">
          <span>{pick('من مطبخنا', 'From our kitchen')}</span>
        </div>
        <h2 data-reveal="1" className="h2">
          {ar ? (
            <>
              Cakes بتحكي <span className="accent">حكايتكم</span>
            </>
          ) : (
            <>
              Cakes that tell <em className="accent">your</em> story
            </>
          )}
        </h2>
        <p data-reveal="1" className="intro">
          {pick('اسحب الصور واقلب أي صورة — ورا كل Cake مناسبة حلوة.', 'Swipe along the line and flip any photo — every cake has a sweet occasion behind it.')}
        </p>
      </div>
      <div ref={scRef} onScroll={onScroll} className="gal-scroller">
        <div className="gal-track">
          <div className="gal-string" />
          {items.map((g) => {
            const on = !!flipped[g.id];
            const title = t(g.title);
            return (
              <div key={g.id} data-swing="1" className="gal-card">
                <div className="gal-clip" />
                <div style={{ paddingTop: 18, transform: `rotate(${g.tilt}deg)`, transformOrigin: '50% 0' }}>
                  <div className="gal-flip" role="button" tabIndex={0} aria-pressed={on} onClick={() => setFlipped((f) => ({ ...f, [g.id]: !f[g.id] }))} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setFlipped((f) => ({ ...f, [g.id]: !f[g.id] })))}>
                    <div className="gal-inner" style={{ transform: `rotateY(${on ? 180 : 0}deg)` }}>
                      <div className="gal-front">
                        <div className="ph">{g.image && <img className="cover" src={g.image} alt={title} loading="lazy" />}</div>
                        <div className="cap">
                          <span>{title}</span>
                          <ArrowsClockwise size={16} color="#B97E5E" />
                        </div>
                      </div>
                      <div className="gal-back" aria-hidden={!on}>
                        <span className="occ">{t(g.occasion)}</span>
                        <span className="ttl">{title}</span>
                        <span className="note">{t(g.note)}</span>
                        <button
                          type="button"
                          className="cta"
                          data-burst="1"
                          tabIndex={on ? 0 : -1}
                          onClick={(e) => {
                            e.stopPropagation();
                            const p = g.productId ? data.products.find((x) => x.id === g.productId && !x.soldOut) : undefined;
                            if (p) {
                              add(p.id);
                              toast(pick('اتضافت لطلبك', 'Added to your order'));
                            } else {
                              track('gallery_design', { item: g.id });
                              scrollToId('custom', reduced);
                            }
                          }}
                        >
                          <ShoppingBagOpen size={18} />
                          {pick('اطلب زيها', 'Order one like it')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="gal-controls">
        <button className="icon-btn lg" onClick={() => by(-1)} aria-label={pick('السابق', 'Previous')}>
          <BackIcon />
        </button>
        <a href={data.settings.instagramUrl} target="_blank" rel="noopener" className="pill-link">
          <InstagramLogo size={19} />
          <bdi dir="ltr">{data.settings.instagramHandle}</bdi>
        </a>
        <button className="icon-btn lg" onClick={() => by(1)} aria-label={pick('التالي', 'Next')}>
          <FwdIcon />
        </button>
      </div>
    </section>
  );
}
