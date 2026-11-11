'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Star } from '@phosphor-icons/react';
import type { Review } from '@/lib/types';
import { useSite } from './SiteProvider';
import { BackIcon, FwdIcon } from './Chrome';

const ROTS = [0, -3.4, 2.8, -1.2];

export function Reviews({ reviews }: { reviews: Review[] }) {
  const { ar, t, pick } = useSite();
  const boxRef = useRef<HTMLDivElement>(null);
  const order = useRef<number[]>(reviews.map((_, i) => i));
  const busy = useRef(false);
  const [top, setTop] = useState(0);

  const cards = () => {
    const m: Record<number, HTMLElement> = {};
    boxRef.current?.querySelectorAll<HTMLElement>('[data-rev]').forEach((el) => (m[+el.dataset.rev!] = el));
    return m;
  };
  const layout = useCallback((instant = false) => {
    const c = cards();
    order.current.forEach((idx, i) => {
      const el = c[idx];
      if (!el) return;
      el.style.transition = instant ? 'none' : 'transform .6s cubic-bezier(.2,.8,.2,1), opacity .45s';
      el.style.zIndex = String(20 - i);
      el.style.opacity = i > 2 ? '0' : '1';
      el.style.transform = `translateY(${i * 16}px) scale(${1 - Math.min(i, 3) * 0.05}) rotate(${ROTS[i % 4]}deg)`;
      el.style.pointerEvents = i === 0 ? 'auto' : 'none';
      el.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    });
  }, []);

  useEffect(() => {
    order.current = reviews.map((_, i) => i);
    layout(true);
  }, [reviews, layout]);

  const fling = (dir: number) => {
    if (busy.current || reviews.length < 2) return;
    const c = cards(), first = order.current[0], el = c[first];
    if (!el) return;
    busy.current = true;
    el.style.transition = 'transform .45s cubic-bezier(.4,0,.6,1), opacity .45s';
    el.style.transform = `translateX(${dir * 560}px) rotate(${dir * 24}deg)`;
    el.style.opacity = '0';
    setTimeout(() => {
      order.current = order.current.slice(1).concat(first);
      layout();
      busy.current = false;
      setTop(order.current[0]);
    }, 400);
  };
  const fwd = () => fling(ar ? 1 : -1);
  const back = () => {
    if (busy.current || reviews.length < 2) return;
    const c = cards(), last = order.current[order.current.length - 1], el = c[last];
    if (!el) return;
    const dir = ar ? -1 : 1;
    el.style.transition = 'none';
    el.style.transform = `translateX(${dir * 560}px) rotate(${dir * 24}deg)`;
    el.style.opacity = '0';
    el.getBoundingClientRect();
    order.current = [last].concat(order.current.slice(0, -1));
    layout();
    setTop(last);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    if (+card.dataset.rev! !== order.current[0] || busy.current) return;
    const sx = e.clientX;
    let dx = 0;
    card.style.transition = 'none';
    const move = (ev: PointerEvent) => {
      dx = ev.clientX - sx;
      card.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      if (Math.abs(dx) > 80) fling(dx > 0 ? 1 : -1);
      else layout();
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  };

  if (!reviews.length) return null;

  return (
    <section id="reviews" className="section reviews">
      <div className="scallop top" style={{ ['--sc' as string]: '#FBF5EE' }} aria-hidden="true" />
      <div className="scallop bottom" style={{ ['--sc' as string]: '#FBF5EE' }} aria-hidden="true" />
      <div className="wrap w1080 center">
        <div data-reveal="1" className="eyebrow">
          <span>{pick('آراء عملائنا', 'Kind words')}</span>
        </div>
        <h2 data-reveal="1" className="h2">
          {ar ? (
            <>
              كلمات <span className="accent">أحلى من السكر</span>
            </>
          ) : (
            <>
              Sweet things <em className="accent">they said</em>
            </>
          )}
        </h2>
        <div
          ref={boxRef}
          className="deck"
          tabIndex={0}
          aria-roledescription="carousel"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') ar ? fwd() : back();
            if (e.key === 'ArrowRight') ar ? back() : fwd();
          }}
        >
          {reviews.map((r, i) => {
            const name = t(r.name);
            return (
              <div key={r.id} data-rev={i} className="rev-card" onPointerDown={onDown}>
                <span className="tape" />
                <div className="stars" aria-label={`${r.rating}/5`}>
                  {Array.from({ length: 5 }, (_, k) => (
                    <Star key={k} size={17} weight={k < r.rating ? 'fill' : 'regular'} />
                  ))}
                </div>
                <p className="q">{t(r.quote)}</p>
                <div className="who">
                  <span className="av">{name.charAt(0)}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                    <span style={{ fontWeight: 600 }}>{name}</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{t(r.occasion)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="sr-only" aria-live="polite">
          {t(reviews[top]?.quote)}
        </p>
        <div className="rev-controls">
          <button className="icon-btn" style={{ width: 48, height: 48 }} onClick={back} aria-label={pick('السابق', 'Previous')}>
            <BackIcon />
          </button>
          <div className="dots">
            {reviews.map((_, i) => (
              <span key={i} className={i === top ? 'on' : ''} />
            ))}
          </div>
          <button className="icon-btn" data-burst="1" style={{ width: 48, height: 48, border: 0, background: 'var(--cocoa)', color: 'var(--on-primary)' }} onClick={fwd} aria-label={pick('التالي', 'Next')}>
            <FwdIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
