'use client';

import { useEffect, useRef } from 'react';
import { FlowerTulip, HandSwipeRight } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { scrollToId } from './Chrome';
import content from '@/lib/content.json';
import { loopWhileVisible, prefersReduced } from '@/lib/petals';

const PETAL_BG = content.flowerRosettePetals.map((p) => (p.type === 'gradient' && p.stops ? `radial-gradient(circle at 100% 100%, ${p.stops.join(', ')})` : ''));

export function Flowers({ photos, onBouquet }: { photos: string[]; onBouquet: () => void }) {
  const { ar, pick, lang, reduced } = useSite();
  const rosRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const rose = useRef({ a: 0, v: 0.06, drag: false, bloomed: false, lx: 0 });

  useEffect(() => {
    const ros = rosRef.current!;
    const red = prefersReduced();
    const petals = Array.from(ros.querySelectorAll<HTMLElement>('[data-petal]'));
    const stop = loopWhileVisible(ros, (t) => {
      const r = rose.current;
      if (!r.drag) {
        r.v += ((red ? 0 : 0.06) - r.v) * 0.02;
        r.a += r.v;
      }
      if (spinRef.current) spinRef.current.style.transform = `rotate(${r.a.toFixed(2)}deg)`;
      if (r.bloomed && !red) petals.forEach((p, i) => (p.style.transform = `scale(${(1 + Math.sin(t / 1200 + i * 1.1) * 0.02).toFixed(4)})`));
    });
    const io = new IntersectionObserver(
      (ents) => {
        if (!ents.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const r = rose.current;
        if (r.bloomed) return;
        r.bloomed = true;
        if (red) return;
        petals.forEach((p, i) => p.animate([{ scale: '0.12', opacity: 0, rotate: '-60deg' }, { scale: '1', opacity: 1, rotate: '0deg' }], { duration: 1300, delay: 140 * i, easing: 'cubic-bezier(.2,.9,.25,1.12)', fill: 'backwards' }));
        r.v = 3;
      },
      { rootMargin: '0px 0px 15% 0px' },
    );
    io.observe(ros);
    return () => {
      stop();
      io.disconnect();
    };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('button')) return;
    const r = rose.current;
    r.drag = true;
    r.lx = e.clientX;
    r.v = 0;
    const move = (ev: PointerEvent) => {
      const d = (ev.clientX - r.lx) * 0.45;
      r.lx = ev.clientX;
      r.a += d;
      r.v = d;
    };
    const up = () => {
      r.drag = false;
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  };

  const chips = content.ui.flowers.chips[lang];
  let ph = 0;

  return (
    <section id="flowers" className="section flowers on-dark">
      <div className="scallop bottom" style={{ ['--sc' as string]: '#FBF5EE' }} aria-hidden="true" />
      <div className="wrap w1240 cols">
        <div className="col">
          <div data-reveal="1" className="eyebrow dark start">
            <span>{pick('هوسنا الحالي', 'Current obsession')}</span>
          </div>
          <h2 data-reveal="1" className="h2 dark">
            {ar ? (
              <>
                مخبز من <span className="accent">الورد</span>
              </>
            ) : (
              <>
                A bakery of <em className="accent">flowers</em>
              </>
            )}
          </h2>
          <p data-reveal="1" className="lead-dark">
            {pick('ورد من الكريمة بيتعمل بتلة بتلة بإيدينا… بوكيهات كب كيك تتهادى، وتتاكل كمان.', 'Buttercream blooms, piped petal by petal by hand — cupcake bouquets made to be gifted, and eaten.')}
          </p>
          <div data-reveal="1" className="fchips">
            {chips.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div data-reveal="1" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, marginTop: 32 }}>
            <button
              className="btn btn-petal"
              data-burst="1"
              style={{ height: 54, padding: '0 26px' }}
              onClick={() => {
                onBouquet();
                setTimeout(() => scrollToId('menu', reduced), 30);
              }}
            >
              <FlowerTulip size={20} />
              {pick('اطلب بوكيه ورد', 'Order a bouquet')}
            </button>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: '#D9C2B4' }}>
              <HandSwipeRight size={20} color="#F2C6BD" />
              {pick('اسحب الوردة عشان تلف', 'Drag the flower to spin it')}
            </span>
          </div>
        </div>
        <div className="col" style={{ display: 'flex', justifyContent: 'center' }}>
          <div ref={rosRef} className="rosette" onPointerDown={onDown} aria-hidden="true">
            <div className="glow" />
            <div className="ring" />
            <div ref={spinRef} className="spin">
              {PETAL_BG.map((bg, i) => {
                const src = bg ? '' : photos[ph++ % Math.max(1, photos.length)] || '';
                return (
                  <div key={i} className="slot" style={{ transform: `rotate(${45 + i * 60}deg)` }}>
                    <div data-petal="1" className="petal" style={bg ? { background: bg } : undefined}>
                      {src && (
                        <div className="pimg">
                          <img className="cover" src={src} alt="" draggable={false} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              className="center"
              data-burst="1"
              aria-label="Spin"
              tabIndex={-1}
              onClick={() => {
                rose.current.v = (Math.random() > 0.5 ? 1 : -1) * 9;
              }}
            >
              P
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
