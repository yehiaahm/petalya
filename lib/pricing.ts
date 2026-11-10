import type { BuilderConfig, Coupon, CustomDesign, L, Lang } from './types';

export function fmtPrice(n: number, lang: Lang) {
  const s = Math.round(n).toLocaleString('en-US');
  return lang === 'ar' ? `${s} ج.م` : `EGP ${s}`;
}

export function fmtDate(d: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!d) return '—';
  const date = d.length <= 10 ? new Date(d + 'T12:00') : new Date(d);
  return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', opts);
}

export function isoDay(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 864e5);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function resolveDesign(cfg: BuilderConfig, d: CustomDesign) {
  const occasion = cfg.occasions.find((o) => o.id === d.occasionId) ?? cfg.occasions[0];
  const size = cfg.sizes.find((s) => s.id === d.sizeId) ?? cfg.sizes[0];
  const flavour = cfg.flavours.find((f) => f.id === d.flavourId) ?? cfg.flavours[0];
  const colour = cfg.colours.find((c) => c.id === d.colourId) ?? cfg.colours[0];
  const decorations = cfg.decorations.filter((x) => d.decorations.includes(x.id));
  return { occasion, size, flavour, colour, decorations };
}

export function designPrice(cfg: BuilderConfig, d: CustomDesign) {
  const r = resolveDesign(cfg, d);
  if (!r.size) return 0;
  let p = r.size.price + (r.flavour?.surcharge ?? 0) * r.size.tiers;
  r.decorations.forEach((x) => (p += x.perTier ? x.price * r.size.tiers : x.price));
  return p;
}

export function designSummary(cfg: BuilderConfig, d: CustomDesign): { k: L; v: L }[] {
  const r = resolveDesign(cfg, d);
  const none = { ar: 'بدون', en: 'None' };
  const decor = r.decorations.length
    ? { ar: r.decorations.map((x) => x.name.ar).join('، '), en: r.decorations.map((x) => x.name.en).join(', ') }
    : none;
  const msg = d.message.trim() || '—';
  const date = d.date ? { ar: fmtDate(d.date, 'ar'), en: fmtDate(d.date, 'en') } : { ar: '—', en: '—' };
  return [
    { k: { ar: 'المناسبة', en: 'Occasion' }, v: r.occasion.name },
    { k: { ar: 'الحجم', en: 'Size' }, v: { ar: `${r.size.name.ar} — ${r.size.serves.ar}`, en: `${r.size.name.en} · ${r.size.serves.en}` } },
    { k: { ar: 'النكهة', en: 'Flavour' }, v: r.flavour.name },
    { k: { ar: 'لون الكريمة', en: 'Colour' }, v: r.colour.name },
    { k: { ar: 'الديكور', en: 'Décor' }, v: decor },
    { k: { ar: 'الكتابة', en: 'Message' }, v: { ar: msg, en: msg } },
    { k: { ar: 'التاريخ', en: 'Date' }, v: date },
  ];
}

export function couponDiscount(c: Coupon | undefined | null, subtotal: number) {
  if (!c || !c.active) return 0;
  if (subtotal < (c.minSubtotal || 0)) return 0;
  if (c.maxUses && c.uses >= c.maxUses) return 0;
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return 0;
  const v = c.type === 'percent' ? (subtotal * Math.min(100, c.value)) / 100 : c.value;
  return Math.min(subtotal, Math.round(v));
}

export const STATUS_FLOW = ['new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'] as const;

export const STATUS_LABEL: Record<string, L> = {
  new: { ar: 'طلب جديد', en: 'Order received' },
  confirmed: { ar: 'اتأكد', en: 'Confirmed' },
  preparing: { ar: 'بيتحضّر', en: 'Being prepared' },
  ready: { ar: 'جاهز', en: 'Ready' },
  out_for_delivery: { ar: 'في الطريق', en: 'Out for delivery' },
  delivered: { ar: 'اتسلّم', en: 'Delivered' },
  cancelled: { ar: 'اتلغى', en: 'Cancelled' },
};

export const PAYMENT_LABEL: Record<string, L> = {
  cod: { ar: 'كاش عند الاستلام', en: 'Cash on delivery' },
  instapay: { ar: 'إنستاباي', en: 'InstaPay' },
  wallet: { ar: 'محفظة إلكترونية', en: 'Mobile wallet' },
};

export function waLink(number: string, msg: string) {
  return 'https://wa.me/' + String(number).replace(/\D/g, '') + '?text=' + encodeURIComponent(msg);
}

/** Egyptian mobile → wa.me international format. */
export function phoneToWa(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('20')) return d;
  if (d.startsWith('0')) return '20' + d.slice(1);
  return d;
}
