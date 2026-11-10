'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { BookOpenText, Cake, GlobeSimple, Heart, Images, InstagramLogo, MagnifyingGlass, ShareNetwork, ShoppingBagOpen, Truck, WhatsappLogo } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { FwdIcon, LangToggle } from './Chrome';
import { LogoRing } from './Hero';
import { makeField, prefersReduced, startLoops, type PetalField } from '@/lib/petals';
import content from '@/lib/content.json';

const ICONS = { Cake, BookOpenText, Images, Heart, Truck } as const;
const ROTS = [-4, 3, -2, 4, -3];

export function LinkInBio() {
  const { ar, pick, lang, wa, data, toast, track } = useSite();
  const rootRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const avRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const field = useRef<PetalField | null>(null);
  const tilt = useRef({ tx: 0, ty: 0, x: 0, y: 0 });
  const strip = useRef<Animation | null>(null);

  const photos = [...data.gallery.map((g) => g.image), ...data.products.flatMap((p) => p.images.slice(0, 1))].filter(Boolean).slice(0, 5);
  const feature = data.gallery[2]?.image || photos[0];

  useEffect(() => {
    const root = rootRef.current!, cv = cvRef.current!;
    const red = prefersReduced();
    const f = makeField(cv, () => ({ w: innerWidth, h: innerHeight }), 120);
    field.current = f;
    f.resize();
    f.setCount(red ? 10 : 28);
    const onR = () => f.resize();
    addEventListener('resize', onR);
    let raf = 0;
    const tick = (t: number) => {
      f.step(t);
      const ring = avRef.current?.querySelector('svg') as SVGElement | null;
      if (ring && !red) ring.style.transform = `rotate(${((t / 1000) * 8) % 360}deg)`;
      const k = tilt.current;
      k.x += (k.tx - k.x) * 0.08;
      k.y += (k.ty - k.y) * 0.08;
      if (cardRef.current) cardRef.current.style.transform = `perspective(900px) rotateX(${(-k.y * 7).toFixed(2)}deg) rotateY(${(k.x * 9).toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    startLoops(root);
    if (!red) {
      root.querySelectorAll<HTMLElement>('[data-in]').forEach((el, i) => {
        const pop = el.dataset.in === 'pop';
        el.animate(pop ? [{ opacity: 0, scale: '0.7' }, { opacity: 1, scale: '1' }] : [{ opacity: 0, translate: '0 26px' }, { opacity: 1, translate: '0 0' }], { duration: pop ? 1200 : 900, delay: 80 + i * 70, easing: 'cubic-bezier(.2,.8,.2,1.05)', fill: 'backwards' });
      });
      setTimeout(() => f.burst(innerWidth / 2, 150, 24), 650);
      if (stripRef.current) strip.current = stripRef.current.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }], { duration: 26000, iterations: Infinity });
    }
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onR);
    };
  }, []);

  const share = async () => {
    const url = location.origin + '/links';
    try {
      if (navigator.share) return await navigator.share({ title: 'Petalya Cakes', text: pick('تورت أنيقة للحظات لا تُنسى', 'Elegant cakes for unforgettable moments'), url });
      await navigator.clipboard.writeText(url);
      toast(pick('اتنسخ اللينك', 'Link copied'));
    } catch {}
  };
  const avatarTap = () => {
    avRef.current?.animate([{ scale: '1' }, { scale: '.86' }, { scale: '1.08' }, { scale: '1' }], { duration: 650, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    const r = avRef.current?.getBoundingClientRect();
    if (r) field.current?.burst(r.left + r.width / 2, r.top + r.height / 2, 30);
  };
  const general = wa(pick('أهلاً Petalya! محتاج/ة مساعدة في طلب.', "Hi Petalya! I need a hand with an order."));

  return (
    <div
      ref={rootRef}
      onPointerMove={(e) => field.current?.pointer(e.clientX, e.clientY, true)}
      onPointerLeave={() => field.current?.pointer(0, 0, false)}
      onPointerDown={(e) => field.current?.burst(e.clientX, e.clientY, 14)}
      style={{ position: 'relative', minHeight: '100svh', overflow: 'hidden', background: 'radial-gradient(110% 46% at 50% 0%, #F8DCD3 0%, rgba(248,220,211,0) 70%), radial-gradient(70% 34% at 100% 100%, rgba(226,178,145,.3), rgba(226,178,145,0) 70%), #FBF5EE', lineHeight: 1.55 }}
    >
      <canvas ref={cvRef} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }} />
      <main style={{ position: 'relative', zIndex: 2, maxWidth: 440, margin: '0 auto', padding: 'calc(14px + env(safe-area-inset-top)) 18px calc(36px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column' }}>
        <div data-in="1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          <button className="icon-btn" onClick={share} aria-label="Share" style={{ background: 'rgba(255,252,248,.8)' }}>
            <ShareNetwork size={20} />
          </button>
          <LangToggle />
        </div>

        <div data-in="pop" style={{ position: 'relative', width: 172, height: 172, margin: '6px auto 0' }}>
          <div ref={avRef} onClick={avatarTap} style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}>
            <LogoRing id="bio-ring" size={9} spacing={2.6} stroke={0.6} dotted={false} />
            <div style={{ position: 'absolute', inset: '12.5%', borderRadius: '50%', overflow: 'hidden', background: '#FBF3EA', boxShadow: '0 26px 44px -22px rgba(74,44,34,.55), 0 0 0 5px rgba(255,252,248,.8), 0 0 0 6px rgba(196,146,116,.35)' }}>
              <img className="cover" src="/assets/logo.png" alt="Petalya" />
            </div>
          </div>
        </div>

        <div data-in="1" style={{ textAlign: 'center', marginTop: 14 }}>
          <div style={{ font: "italic 500 50px/1 var(--f-cormorant), serif", letterSpacing: '-.01em' }}>Petalya</div>
          <div className="eyebrow" style={{ marginTop: 8, gap: 10 }}>
            <span style={ar ? { font: '500 15px/1.4 var(--f-messiri), serif' } : { fontSize: 11, letterSpacing: '.24em' }}>
              {pick('تورت وكب كيك · ', 'Cakes & cupcakes · ')}
              <bdi dir="ltr">{data.settings.instagramHandle}</bdi>
            </span>
          </div>
          <p style={{ margin: '14px auto 0', maxWidth: '22em', fontSize: 15, lineHeight: 1.75, color: 'var(--ink-muted)' }}>{ar ? content.linkInBio.bio.ar : content.linkInBio.bio.en}</p>
        </div>

        <Link data-in="1" href="/#menu" className="bio-press" style={{ position: 'relative', overflow: 'hidden', marginTop: 26, display: 'flex', alignItems: 'center', gap: 14, minHeight: 72, padding: '12px 16px', borderRadius: 24, background: 'var(--rose-gold)', color: '#FFF7F0', boxShadow: '0 22px 40px -22px rgba(126,74,48,.85)' }}>
          <span data-sheen="3800" className="sheen" />
          <span style={{ flex: 'none', width: 46, height: 46, borderRadius: 16, background: 'rgba(255,247,240,.16)', display: 'grid', placeItems: 'center' }}>
            <ShoppingBagOpen size={26} />
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>{pick('اطلب من الموقع', 'Order on the website')}</span>
            <span style={{ fontSize: 13, color: '#F6E2D6' }}>{pick('تورت · كب كيك · بوكيهات', 'Cakes · cupcakes · bouquets')}</span>
          </span>
          <FwdIcon size={20} />
        </Link>

        <Link
          data-in="1"
          ref={cardRef}
          href="/#flowers"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            tilt.current.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
            tilt.current.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
          }}
          onPointerLeave={() => {
            tilt.current.tx = 0;
            tilt.current.ty = 0;
          }}
          style={{ position: 'relative', overflow: 'hidden', marginTop: 12, display: 'flex', alignItems: 'center', gap: 16, padding: 14, paddingInlineEnd: 18, borderRadius: 26, background: 'radial-gradient(80% 120% at 0% 0%, rgba(222,150,139,.28), rgba(222,150,139,0) 60%), #2B1B16', color: '#FBF1E8', boxShadow: '0 26px 44px -26px rgba(43,27,22,.8)', willChange: 'transform' }}
        >
          <span style={{ position: 'relative', flex: 'none', width: 96, height: 112, borderRadius: 18, overflow: 'hidden', background: '#3A2620' }}>{feature && <img className="cover" src={feature} alt="" />}</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={ar ? { font: '500 14px/1.4 var(--f-messiri), serif', color: '#F2C6BD' } : { fontSize: 10.5, fontWeight: 600, letterSpacing: '.24em', textTransform: 'uppercase', color: '#F2C6BD' }}>{pick('هوسنا الحالي', 'Current obsession')}</span>
            <span style={ar ? { font: '600 25px/1.3 var(--f-messiri), serif' } : { font: 'italic 500 30px/1.05 var(--f-cormorant), serif' }}>{pick('مخبز الورد', 'Bakery of flowers')}</span>
            <span style={{ fontSize: 13, lineHeight: 1.55, color: '#D9C2B4' }}>{pick('بوكيهات كب كيك شكلها ورد حقيقي', 'Cupcake bouquets that look like the real thing')}</span>
          </span>
          <span style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', background: '#F2C6BD', color: '#2B1B16', display: 'grid', placeItems: 'center' }}>
            <FwdIcon size={17} />
          </span>
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {content.linkInBio.links.map((l) => {
            const Ic = ICONS[l.icon as keyof typeof ICONS];
            const tx = l[lang];
            return (
              <Link data-in="1" key={l.href} href={'/' + l.href} className="bio-row" onClick={() => track('link_click', { to: l.href })}>
                <span className="tile-ic" style={{ width: 46, height: 46 }}>
                  <Ic size={23} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{tx.title}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{tx.desc}</span>
                </span>
                <span style={{ color: '#B97E5E', display: 'grid' }}>
                  <FwdIcon />
                </span>
              </Link>
            );
          })}
          <Link data-in="1" href="/track" className="bio-row">
            <span className="tile-ic" style={{ width: 46, height: 46 }}>
              <MagnifyingGlass size={23} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{pick('تتبّع طلبك', 'Track your order')}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{pick('برقم الطلب والموبايل', 'With your order number and phone')}</span>
            </span>
            <span style={{ color: '#B97E5E', display: 'grid' }}>
              <FwdIcon />
            </span>
          </Link>
        </div>

        <div data-in="1" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 30, padding: '0 4px' }}>
          <span style={ar ? { font: '600 20px/1.3 var(--f-messiri), serif' } : { font: 'italic 500 26px/1.1 var(--f-cormorant), serif' }}>{pick('من مطبخنا', 'From our kitchen')}</span>
          <a href={data.settings.instagramUrl} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600 }}>
            <InstagramLogo size={17} />
            {pick('شوف الكل', 'See all')}
          </a>
        </div>
        <div onPointerDown={() => strip.current?.pause()} onPointerUp={() => strip.current?.play()} onPointerLeave={() => strip.current?.play()} style={{ margin: '10px -18px 0', overflow: 'hidden', padding: '18px 0 26px' }}>
          <div ref={stripRef} dir="ltr" style={{ display: 'flex', gap: 14, width: 'max-content', paddingLeft: 14, willChange: 'transform' }}>
            {[...photos, ...photos].map((src, i) => (
              <div key={i} style={{ flex: 'none', width: 118, background: '#FFFCF8', padding: '6px 6px 20px', borderRadius: 2, boxShadow: '0 18px 30px -20px rgba(74,44,34,.6), 0 2px 5px rgba(74,44,34,.08)', transform: `rotate(${ROTS[i % 5]}deg)` }}>
                <div style={{ aspectRatio: '1/1.05', background: `url(${src}) center/cover #F3E4DA` }} />
              </div>
            ))}
          </div>
        </div>

        <footer data-in="1" style={{ marginTop: 14, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <a href={data.settings.instagramUrl} target="_blank" rel="noopener" aria-label="Instagram" className="icon-btn" style={{ background: 'transparent' }}>
              <InstagramLogo size={20} />
            </a>
            <a href={general} target="_blank" rel="noopener" aria-label="WhatsApp" className="icon-btn" style={{ background: 'transparent' }}>
              <WhatsappLogo size={20} />
            </a>
            <Link href="/" aria-label="Website" className="icon-btn" style={{ background: 'transparent' }}>
              <GlobeSimple size={20} />
            </Link>
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 13.5, color: 'var(--ink-muted)' }}>{pick('معمولة طازة وبكل حب · أمنية الجندي', 'Freshly made with love · by Omnia El Gendy')}</p>
          <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--ink-faint)' }}>© {new Date().getFullYear()} Petalya Cakes</p>
        </footer>
      </main>
    </div>
  );
}
