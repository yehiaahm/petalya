'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CustomDesign, L, Lang, Product, PublicData, PublicUser } from '@/lib/types';
import { designPrice, fmtPrice, waLink } from '@/lib/pricing';

export type CartLine =
  | { key: string; kind: 'product'; productId: string; qty: number }
  | { key: string; kind: 'custom'; design: CustomDesign; qty: number };

export type ResolvedLine = CartLine & { name: L; image?: string; unitPrice: number; product?: Product; colour?: string };

type Ctx = {
  lang: Lang;
  ar: boolean;
  t: (l: L | undefined | null) => string;
  pick: <T>(ar: T, en: T) => T;
  fmt: (n: number) => string;
  showPrices: boolean;
  toggleLang: () => void;
  data: PublicData;
  cart: CartLine[];
  lines: ResolvedLine[];
  count: number;
  subtotal: number;
  qtyOf: (productId: string) => number;
  add: (productId: string, n?: number) => void;
  dec: (productId: string) => void;
  setQty: (key: string, qty: number) => void;
  addCustom: (d: CustomDesign) => void;
  clear: () => void;
  burst: (x: number, y: number, n?: number) => void;
  track: (type: string, meta?: Record<string, string | number>) => void;
  toast: (msg: string) => void;
  wa: (msg: string) => string;
  reduced: boolean;
  hydrated: boolean;
  user: PublicUser | null;
  setUser: (u: PublicUser | null) => void;
};

const SiteCtx = createContext<Ctx | null>(null);
export const useSite = () => {
  const c = useContext(SiteCtx);
  if (!c) throw new Error('useSite outside SiteProvider');
  return c;
};

const CART_KEY = 'petalya.cart.v1';

function device(): 'mobile' | 'tablet' | 'desktop' {
  const w = window.innerWidth;
  return w < 700 ? 'mobile' : w < 1060 ? 'tablet' : 'desktop';
}

export function SiteProvider({ data, initialLang, initialUser = null, children }: { data: PublicData; initialLang: Lang; initialUser?: PublicUser | null; children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [user, setUser] = useState<PublicUser | null>(initialUser);
  useEffect(() => setUser(initialUser), [initialUser]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [toastMsg, setToastMsg] = useState<{ m: string; k: number } | null>(null);
  const [reduced, setReduced] = useState(false);
  const fxRef = useRef<HTMLDivElement>(null);
  const fading = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const queue = useRef<object[]>([]);

  /* ---------- boot ---------- */
  useEffect(() => {
    setReduced(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if ((q === 'ar' || q === 'en') && q !== lang) applyLang(q);
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setCart(JSON.parse(raw));
    } catch {}
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only persist once the saved cart has been restored into state, or an empty cart would overwrite it.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart, hydrated]);

  /* ---------- analytics ---------- */
  const flush = useCallback(() => {
    if (!queue.current.length) return;
    const body = JSON.stringify(queue.current.splice(0));
    try {
      if (!navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) {
        fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } });
      }
    } catch {}
  }, []);

  const track = useCallback(
    (type: string, meta?: Record<string, string | number>) => {
      let sid = '';
      try {
        sid = sessionStorage.getItem('petalya.sid') || '';
        if (!sid) {
          sid = Math.random().toString(36).slice(2, 12);
          sessionStorage.setItem('petalya.sid', sid);
        }
      } catch {}
      queue.current.push({ type, sid, path: location.pathname, ref: document.referrer || '', device: device(), meta });
      setTimeout(flush, 800);
    },
    [flush],
  );

  useEffect(() => {
    track('page_view');
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [track, flush]);

  /* ---------- language ---------- */
  function applyLang(next: Lang) {
    document.cookie = `petalya.lang=${next}; path=/; max-age=31536000; samesite=lax`;
    try {
      localStorage.setItem('petalya.lang', next);
    } catch {}
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    setLang(next);
  }

  const toggleLang = useCallback(() => {
    const next: Lang = lang === 'ar' ? 'en' : 'ar';
    if (fading.current) return;
    const root = document.body;
    if (reduced) return applyLang(next);
    fading.current = true;
    const a = root.animate([{ opacity: 1 }, { opacity: 0.02 }], { duration: 170, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => {
      applyLang(next);
      requestAnimationFrame(() => {
        a.cancel();
        root.animate([{ opacity: 0.02 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
        fading.current = false;
      });
    };
  }, [lang, reduced]);

  /* ---------- confetti ---------- */
  const burst = useCallback(
    (x: number, y: number, n = 12) => {
      const layer = fxRef.current;
      if (!layer || reduced) return;
      const C = ['#F2C6BD', '#E8A398', '#F8DCD5', '#D9A676'];
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        const g = i % 4 === 3, w = g ? 6 : 9 + Math.random() * 6, h = g ? 6 : w * 1.3;
        s.style.cssText = `position:absolute;left:${x - w / 2}px;top:${y - h / 2}px;width:${w}px;height:${h}px;background:${C[i % 4]};border-radius:${g ? '1px' : '50% 50% 50% 50% / 60% 60% 40% 40%'};`;
        layer.appendChild(s);
        const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70, dx = Math.cos(a) * d, dy = Math.sin(a) * d - 30, rot = (Math.random() - 0.5) * 540;
        const an = s.animate(
          [
            { transform: 'translate(0,0) rotate(0deg) scale(.6)', opacity: 1 },
            { transform: `translate(${dx}px,${dy}px) rotate(${rot / 2}deg) scale(1)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${dx * 1.15}px,${dy + 70}px) rotate(${rot}deg) scale(.8)`, opacity: 0 },
          ],
          { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' },
        );
        an.onfinish = () => s.remove();
      }
    },
    [reduced],
  );

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.('[data-burst]')) burst(e.clientX, e.clientY, 12);
    };
    document.addEventListener('pointerdown', down);
    return () => document.removeEventListener('pointerdown', down);
  }, [burst]);

  /* ---------- toast ---------- */
  const lastToast = useRef('');
  const toast = useCallback((m: string) => {
    lastToast.current = m;
    setToastMsg({ m, k: Date.now() });
  }, []);
  useEffect(() => {
    if (!toastMsg) return;
    const id = setTimeout(() => setToastMsg(null), 2400);
    return () => clearTimeout(id);
  }, [toastMsg]);

  /* ---------- cart ---------- */
  const productMap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products]);

  const lines = useMemo<ResolvedLine[]>(() => {
    const out: ResolvedLine[] = [];
    for (const l of cart) {
      if (l.kind === 'product') {
        const p = productMap.get(l.productId);
        if (!p) continue;
        out.push({ ...l, name: p.name, image: p.images[0], unitPrice: p.price, product: p });
      } else {
        const cfg = data.settings.builder;
        const size = cfg.sizes.find((s) => s.id === l.design.sizeId);
        const occ = cfg.occasions.find((o) => o.id === l.design.occasionId);
        const col = cfg.colours.find((c) => c.id === l.design.colourId);
        out.push({
          ...l,
          name: { ar: `تورتة ${occ?.name.ar ?? ''} مخصوصة · ${size?.name.ar ?? ''}`, en: `Custom ${occ?.name.en ?? ''} cake · ${size?.name.en ?? ''}` },
          unitPrice: designPrice(cfg, l.design),
          colour: col?.base,
        });
      }
    }
    return out;
  }, [cart, productMap, data.settings.builder]);

  const count = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);

  const qtyOf = useCallback((id: string) => cart.find((l) => l.kind === 'product' && l.productId === id)?.qty ?? 0, [cart]);
  const add = useCallback(
    (id: string, n = 1) => {
      setCart((c) => {
        const i = c.findIndex((l) => l.kind === 'product' && l.productId === id);
        if (i < 0) return [...c, { key: 'p:' + id, kind: 'product', productId: id, qty: n }];
        const copy = [...c];
        copy[i] = { ...copy[i], qty: copy[i].qty + n };
        return copy;
      });
      track('add_to_cart', { product: id });
    },
    [track],
  );
  const dec = useCallback((id: string) => {
    setCart((c) => c.flatMap((l) => (l.kind === 'product' && l.productId === id ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l])));
  }, []);
  const setQty = useCallback((key: string, qty: number) => {
    setCart((c) => c.flatMap((l) => (l.key === key ? (qty > 0 ? [{ ...l, qty: Math.min(50, qty) }] : []) : [l])));
  }, []);
  const addCustom = useCallback(
    (design: CustomDesign) => {
      setCart((c) => [...c, { key: 'c:' + Date.now().toString(36), kind: 'custom', design, qty: 1 }]);
      track('add_to_cart', { product: 'custom-cake' });
    },
    [track],
  );
  const clear = useCallback(() => setCart([]), []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      ar: lang === 'ar',
      t: (l) => (l ? l[lang] || l.ar || l.en || '' : ''),
      pick: (a, e) => (lang === 'ar' ? a : e),
      fmt: (n) => fmtPrice(n, lang),
      showPrices: !!data.settings.showPrices,
      toggleLang,
      data,
      cart,
      lines,
      count,
      subtotal,
      qtyOf,
      add,
      dec,
      setQty,
      addCustom,
      clear,
      burst,
      track,
      toast,
      wa: (m) => waLink(data.settings.whatsapp, m),
      reduced,
      hydrated,
      user,
      setUser,
    }),
    [lang, toggleLang, data, cart, lines, count, subtotal, qtyOf, add, dec, setQty, addCustom, clear, burst, track, toast, reduced, hydrated, user],
  );

  return (
    <SiteCtx.Provider value={value}>
      {children}
      <div className={'toast' + (toastMsg ? ' show' : '')} aria-live="polite">
        <svg width="18" height="18" viewBox="0 0 256 256" fill="#F2C6BD" aria-hidden>
          <path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm45.66 85.66-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 11.32Z" />
        </svg>
        {lastToast.current}
      </div>
      <div ref={fxRef} className="fx-layer" aria-hidden="true" />
    </SiteCtx.Provider>
  );
}
