'use client';

import { useEffect, useRef } from 'react';
import { Cake } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { FwdIcon, scrollToId } from './Chrome';
import contentJson from '@/lib/content.json';
import { loopWhileVisible, makeField, prefersReduced, type PetalField } from '@/lib/petals';

export function LogoRing({ id, size = 8.4, spacing = 2.4, stroke = 0.5, dotted = true }: { id: string; size?: number; spacing?: number; stroke?: number; dotted?: boolean }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', direction: 'ltr' }} data-ring="1">
      <defs>
        <path id={id} d="M 13,100 A 87,87 0 1,1 187,100 A 87,87 0 1,1 13,100" />
      </defs>
      <circle cx="100" cy="100" r="97.5" style={{ fill: 'none', stroke: '#C49274', strokeWidth: stroke, opacity: 0.7 }} />
      {dotted && <circle cx="100" cy="100" r="78.6" style={{ fill: 'none', stroke: '#C49274', strokeWidth: 0.45, strokeDasharray: '1 2.4', opacity: 0.8 }} />}
      <text style={{ fill: '#8A5537', fontFamily: 'var(--f-cormorant), serif', fontWeight: 600, fontSize: size, letterSpacing: spacing }}>
        <textPath href={'#' + id} textLength="540" lengthAdjust="spacing">
          PETALYA · CAKES &amp; CUPCAKES · FRESHLY MADE WITH LOVE ·
        </textPath>
      </text>
    </svg>
  );
}

export function Hero({ images }: { images: [string, string] }) {
  const { ar, pick, reduced } = useSite();
  const heroRef = useRef<HTMLElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const polL = useRef<HTMLDivElement>(null);
  const polR = useRef<HTMLDivElement>(null);
  const field = useRef<PetalField | null>(null);
  const ptr = useRef({ tx: 0, ty: 0, cx: 0, cy: 0 });

  useEffect(() => {
    const hero = heroRef.current!, cv = cvRef.current!;
    const red = prefersReduced();
    const f = makeField(cv, () => {
      const r = hero.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    field.current = f;
    f.resize();
    f.setCount(red ? 10 : Math.round(46 * Math.max(0.6, Math.min(1.5, (innerWidth * innerHeight) / (390 * 844)))));
    const ro = new ResizeObserver(() => f.resize());
    ro.observe(hero);

    const stop = loopWhileVisible(hero, (t) => {
      f.step(t);
      const h = ptr.current;
      h.cx += (h.tx - h.cx) * 0.06;
      h.cy += (h.ty - h.cy) * 0.06;
      const bob = red ? 0 : Math.sin(t / 1500) * 7;
      if (tiltRef.current) tiltRef.current.style.transform = `perspective(1000px) translateY(${bob.toFixed(2)}px) rotateX(${(-h.cy * 9).toFixed(2)}deg) rotateY(${(h.cx * 11).toFixed(2)}deg)`;
      const ring = ringRef.current?.querySelector('svg') as SVGElement | null;
      if (ring && !red) ring.style.transform = `rotate(${((t / 1000) * 6) % 360}deg)`;
      if (polL.current) polL.current.style.transform = `translate(${(-h.cx * 16).toFixed(1)}px, ${(-h.cy * 12 + Math.sin(t / 1900) * 5).toFixed(1)}px) rotate(${(-h.cx * 3).toFixed(2)}deg)`;
      if (polR.current) polR.current.style.transform = `translate(${(-h.cx * 22).toFixed(1)}px, ${(-h.cy * 16 + Math.cos(t / 2100) * 6).toFixed(1)}px) rotate(${(-h.cx * 4).toFixed(2)}deg)`;
    });

    let burstT: ReturnType<typeof setTimeout> | undefined;
    if (!red) {
      hero.querySelectorAll<HTMLElement>('[data-intro]').forEach((el, i) => {
        const pop = el.dataset.intro === 'pop';
        el.animate(pop ? [{ opacity: 0, scale: '0.82' }, { opacity: 1, scale: '1' }] : [{ opacity: 0, translate: '0 30px' }, { opacity: 1, translate: '0 0' }], { duration: pop ? 1400 : 1100, delay: 100 + i * 110, easing: 'cubic-bezier(.2,.75,.2,1)', fill: 'backwards' });
      });
      burstT = setTimeout(() => {
        const r = hero.getBoundingClientRect();
        f.burst(r.width / 2, r.height * 0.32, 26);
      }, 700);
    }
    return () => {
      stop();
      ro.disconnect();
      clearTimeout(burstT);
    };
  }, []);

  const pt = (e: React.PointerEvent) => {
    const r = heroRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  };
  const onMove = (e: React.PointerEvent) => {
    const p = pt(e);
    field.current?.pointer(p.x, p.y, true);
    ptr.current.tx = (p.x / p.w - 0.5) * 2;
    ptr.current.ty = (p.y / p.h - 0.5) * 2;
  };
  const onLeave = () => {
    field.current?.pointer(0, 0, false);
    ptr.current.tx = 0;
    ptr.current.ty = 0;
  };
  const onDown = (e: React.PointerEvent) => {
    const p = pt(e);
    field.current?.burst(p.x, p.y, 18);
    onMove(e);
  };

  const go = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    scrollToId(id, reduced);
  };

  return (
    <section id="top" ref={heroRef} className="hero" onPointerMove={onMove} onPointerDown={onDown} onPointerLeave={onLeave}>
      <canvas ref={cvRef} aria-hidden="true" />
      <div className="inner">
        <div data-intro="pop" className="emblem">
          <div ref={polL} style={{ position: 'absolute', zIndex: 1, top: 0, insetInlineStart: '-27%', width: '40%' }}>
            <div className="polaroid" style={{ transform: 'rotate(-10deg)' }}>
              <span className="tape" style={{ width: 46, height: 16, marginLeft: -23, background: 'rgba(242,198,189,.85)', transform: 'rotate(4deg)' }} />
              <div className="ph">
                <img className="cover" src={images[0]} alt="" />
              </div>
            </div>
          </div>
          <div ref={polR} style={{ position: 'absolute', zIndex: 1, bottom: '2%', insetInlineEnd: '-25%', width: '37%' }}>
            <div className="polaroid" style={{ transform: 'rotate(8deg)' }}>
              <span className="tape" style={{ width: 42, height: 15, marginLeft: -21, background: 'rgba(226,178,145,.8)', transform: 'rotate(-5deg)' }} />
              <div className="ph">
                <img className="cover" src={images[1]} alt="" />
              </div>
            </div>
          </div>
          <div ref={tiltRef} style={{ position: 'absolute', inset: 0, zIndex: 2, willChange: 'transform' }}>
            <div ref={ringRef} style={{ position: 'absolute', inset: 0 }}>
              <LogoRing id="pt-ring" />
            </div>
            <div style={{ position: 'absolute', inset: '12.5%', borderRadius: '50%', overflow: 'hidden', background: '#FBF3EA', boxShadow: '0 34px 60px -26px rgba(74,44,34,.5), 0 0 0 6px rgba(255,252,248,.75), 0 0 0 7px rgba(196,146,116,.35)' }}>
              <img className="cover" src="/assets/logo.png" alt="Petalya" />
            </div>
          </div>
        </div>

        <div data-intro="1" className="eyebrow" style={{ marginBottom: 16 }}>
          <span>{pick('تورت وكب كيك · بتوقيع أمنية الجندي', 'Cakes & cupcakes · by Omnia El Gendy')}</span>
        </div>
        {ar ? (
          <h1 data-intro="1">
            تورت أنيقة <span data-shine="1" className="shine-text">للحظات لا تُنسى</span>
          </h1>
        ) : (
          <h1 data-intro="1">
            Elegant cakes for <em data-shine="1" className="shine-text">unforgettable</em> moments
          </h1>
        )}
        <p data-intro="1" className="lead">
          {pick('تورت مصمَّمة خصيصًا لمناسبتك، وكب كيك مصنوع يدويًا، طازج كل يوم وبكل حب.', 'Custom cakes for your occasion and handcrafted cupcakes — freshly made, every day, with love.')}
        </p>
        <div data-intro="1" className="ctas">
          <a href="#custom" onClick={(e) => go(e, 'custom')} className="btn btn-primary" style={{ padding: '0 28px' }}>
            <span data-sheen="1" className="sheen" />
            <Cake size={20} />
            {pick('صمّم تورتتك', 'Design your cake')}
          </a>
          <a href="#menu" onClick={(e) => go(e, 'menu')} className="btn btn-outline">
            {pick('تصفّح المنيو', 'Browse the menu')}
            <FwdIcon />
          </a>
        </div>
        <div data-intro="1" className="hint">
          <span className="pulse-dot">
            <span />
            <span />
          </span>
          {pick('المس الشاشة… وشاهد البتلات تتطاير', 'Touch anywhere — watch the petals fly')}
        </div>
      </div>
    </section>
  );
}

const content_mq = contentJson.ui.marquee as { ar: string[]; en: string[] };

export function Marquee() {
  const { lang } = useSite();
  const items = content_mq[lang];
  const row = items.concat(items);
  return (
    <div className="marquee" aria-hidden="true">
      <div className="track">
        {row.map((t, i) => (
          <span key={i} className="item">
            {t}
            <i />
          </span>
        ))}
      </div>
    </div>
  );
}

