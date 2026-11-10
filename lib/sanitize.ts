import 'server-only';
import type { Category, Coupon, GalleryItem, L, Product, Review, Settings } from './types';
import { shortId } from './crypto';

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, min = 0, max = 1e7) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const bool = (v: unknown) => v === true;
export const lstr = (v: unknown, max = 500): L => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const ar = str(o.ar, max), en = str(o.en, max);
  return { ar: ar || en, en: en || ar };
};
const img = (v: unknown) => {
  const s = str(v, 300);
  return /^\/(uploads|assets)\/[\w.\-]+$/.test(s) || /^https:\/\/[^\s"'<>]+$/.test(s) ? s : '';
};
const id = (v: unknown, prefix: string) => {
  const s = str(v, 40);
  return /^[\w-]{1,40}$/.test(s) ? s : prefix + shortId(6).toLowerCase();
};

export function cleanProduct(v: Partial<Product>, prev?: Product): Product {
  const now = new Date().toISOString();
  const compare = num(v.compareAt, 0);
  const lead = v.leadDays == null || (v.leadDays as unknown) === '' ? null : num(v.leadDays, 0, 60);
  return {
    id: prev?.id ?? id(undefined, 'p'),
    categoryId: str(v.categoryId, 40),
    name: lstr(v.name, 120),
    desc: lstr(v.desc, 600),
    price: Math.round(num(v.price, 0)),
    compareAt: compare > 0 ? Math.round(compare) : null,
    images: (Array.isArray(v.images) ? v.images : []).map(img).filter(Boolean).slice(0, 12),
    active: v.active !== false,
    featured: bool(v.featured),
    soldOut: bool(v.soldOut),
    leadDays: lead,
    sort: num(v.sort ?? prev?.sort ?? 999, 0, 9999),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
}

export function cleanCategories(list: unknown): Category[] {
  return (Array.isArray(list) ? list : []).slice(0, 30).map((c: Partial<Category>, i) => ({ id: id(c.id, 'cat-'), name: lstr(c.name, 60), sort: i })).filter((c) => c.name.ar || c.name.en);
}

export function cleanGallery(list: unknown): GalleryItem[] {
  return (Array.isArray(list) ? list : []).slice(0, 40).map((g: Partial<GalleryItem>, i) => ({
    id: id(g.id, 'g-'),
    image: img(g.image),
    productId: str(g.productId, 40) || undefined,
    tilt: num(g.tilt, -6, 6),
    title: lstr(g.title, 80),
    occasion: lstr(g.occasion, 60),
    note: lstr(g.note, 300),
    active: g.active !== false,
    sort: i,
  }));
}

export function cleanReviews(list: unknown): Review[] {
  return (Array.isArray(list) ? list : []).slice(0, 300).map((r: Partial<Review>) => ({
    id: id(r.id, 'r-'),
    name: lstr(r.name, 60),
    occasion: lstr(r.occasion, 60),
    quote: lstr(r.quote, 500),
    rating: Math.round(num(r.rating, 1, 5)),
    status: (r.status === 'pending' || r.status === 'hidden' ? r.status : 'approved') as Review['status'],
    ...(r.orderCode ? { orderCode: str(r.orderCode, 20) } : {}),
    createdAt: str(r.createdAt, 40) || new Date().toISOString(),
  }));
}

export function cleanCoupons(list: unknown): Coupon[] {
  return (Array.isArray(list) ? list : []).slice(0, 100).map((c: Partial<Coupon>) => ({
    id: id(c.id, 'cp-'),
    code: str(c.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
    type: (c.type === 'fixed' ? 'fixed' : 'percent') as Coupon['type'],
    value: num(c.value, 0, c.type === 'fixed' ? 1e6 : 100),
    minSubtotal: num(c.minSubtotal, 0),
    active: c.active !== false,
    uses: Math.round(num(c.uses, 0)),
    maxUses: c.maxUses ? Math.round(num(c.maxUses, 1)) : null,
    expiresAt: c.expiresAt ? str(c.expiresAt, 10) : null,
    createdAt: str(c.createdAt, 40) || new Date().toISOString(),
  })).filter((c) => c.code);
}

export function cleanSettings(v: Partial<Settings>, prev: Settings): Settings {
  const b = v.builder ?? prev.builder;
  return {
    whatsapp: str(v.whatsapp, 20).replace(/\D/g, '') || prev.whatsapp,
    instagramUrl: /^https:\/\//.test(str(v.instagramUrl)) ? str(v.instagramUrl, 200) : prev.instagramUrl,
    instagramHandle: str(v.instagramHandle, 40) || prev.instagramHandle,
    storeOpen: v.storeOpen !== false,
    showPrices: v.showPrices === true,
    closedMessage: lstr(v.closedMessage ?? prev.closedMessage, 200),
    leadDays: Math.round(num(v.leadDays, 0, 60)),
    standardLeadDays: Math.round(num(v.standardLeadDays, 0, 60)),
    deliveryEnabled: bool(v.deliveryEnabled),
    pickupEnabled: bool(v.pickupEnabled),
    pickupAddress: lstr(v.pickupAddress ?? prev.pickupAddress, 200),
    zones: (Array.isArray(v.zones) ? v.zones : prev.zones).slice(0, 60).map((z) => ({ id: id(z.id, 'z-'), name: lstr(z.name, 60), fee: Math.round(num(z.fee, 0)), active: z.active !== false })).filter((z) => z.name.ar),
    timeSlots: (Array.isArray(v.timeSlots) ? v.timeSlots : prev.timeSlots).slice(0, 10).map((t) => ({ id: id(t.id, 't-'), name: lstr(t.name, 60) })).filter((t) => t.name.ar),
    payments: {
      cod: { enabled: bool(v.payments?.cod?.enabled) },
      instapay: { enabled: bool(v.payments?.instapay?.enabled), handle: str(v.payments?.instapay?.handle, 60) },
      wallet: { enabled: bool(v.payments?.wallet?.enabled), number: str(v.payments?.wallet?.number, 20) },
    },
    builder: {
      enabled: b.enabled !== false,
      occasions: b.occasions.slice(0, 20).map((o) => ({ id: id(o.id, 'o'), name: lstr(o.name, 40), topper: lstr(o.topper, 30) })),
      sizes: b.sizes.slice(0, 3).map((s) => ({ id: id(s.id, 's'), tiers: Math.round(num(s.tiers, 1, 3)), price: Math.round(num(s.price, 0)), name: lstr(s.name, 40), serves: lstr(s.serves, 40) })),
      flavours: b.flavours.slice(0, 20).map((f) => ({ id: id(f.id, 'f'), name: lstr(f.name, 40), surcharge: Math.round(num(f.surcharge, 0)) })),
      colours: b.colours.slice(0, 12).map((c) => {
        const hex = (x: unknown, d: string) => (/^#[0-9a-f]{6}$/i.test(str(x)) ? str(x) : d);
        return { id: id(c.id, 'c'), name: lstr(c.name, 40), base: hex(c.base, '#F3CBC2'), light: hex(c.light, '#FAE3DD'), dark: hex(c.dark, '#E0A497'), ...(c.messageColour ? { messageColour: hex(c.messageColour, '#FBEFE6') } : {}) };
      }),
      decorations: b.decorations.slice(0, 8).map((d) => ({ id: id(d.id, 'd'), icon: str(d.icon, 20) || 'Sparkle', price: Math.round(num(d.price, 0)), perTier: bool(d.perTier), name: lstr(d.name, 40) })),
    },
  };
}
