import 'server-only';
import type { CustomDesign, DB, Lang, Order, OrderItem, PaymentMethod } from './types';
import { couponDiscount, designPrice, designSummary, isoDay } from './pricing';
import { shortId } from './crypto';
import { arCount } from './ar';

export type OrderInput = {
  lines: ({ kind: 'product'; productId: string; qty: number } | { kind: 'custom'; design: CustomDesign; qty: number })[];
  customer: { name: string; phone: string; email?: string };
  fulfillment: { type: 'delivery' | 'pickup'; zoneId?: string; address?: string; date: string; slotId?: string };
  payment: PaymentMethod;
  notes?: string;
  refImages?: string[];
  coupon?: string;
  lang?: Lang;
};

export class OrderError extends Error {
  constructor(public field: string, public msg: { ar: string; en: string }) {
    super(msg.en);
  }
}

const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function normalisePhone(p: string) {
  let d = p.replace(/[^\d+]/g, '').replace(/^\+/, '');
  // Arabic-Indic digits → ASCII
  d = d.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660));
  if (d.startsWith('20')) d = '0' + d.slice(2);
  return d;
}

function toAscii(s: string) {
  return s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0));
}

/** Validates the input against the live DB and builds the order. Prices always come from the DB. */
export function buildOrder(db: DB, raw: OrderInput): Order {
  const s = db.settings;
  if (!s.storeOpen) throw new OrderError('store', { ar: 'مش بناخد طلبات دلوقتي.', en: 'The shop is not taking orders right now.' });
  if (!Array.isArray(raw?.lines) || !raw.lines.length) throw new OrderError('cart', { ar: 'طلبك فاضي.', en: 'Your bag is empty.' });

  const items: OrderItem[] = [];
  let lead = s.standardLeadDays;
  for (const l of raw.lines.slice(0, 40)) {
    const qty = Math.max(1, Math.min(50, Math.floor(Number(l.qty) || 1)));
    if (l.kind === 'product') {
      const p = db.products.find((x) => x.id === l.productId && x.active);
      if (!p) throw new OrderError('cart', { ar: 'فيه منتج في طلبك مبقاش متاح.', en: 'An item in your bag is no longer available.' });
      if (p.soldOut) throw new OrderError('cart', { ar: `«${p.name.ar}» خلص النهارده.`, en: `"${p.name.en}" is sold out today.` });
      lead = Math.max(lead, p.leadDays ?? 0);
      items.push({ kind: 'product', productId: p.id, name: p.name, image: p.images[0], unitPrice: p.price, qty });
    } else if (l.kind === 'custom') {
      if (!s.builder.enabled) throw new OrderError('cart', { ar: 'الـ Custom Cakes مش متاحة دلوقتي.', en: 'Custom cakes are unavailable right now.' });
      const cfg = s.builder;
      const d = l.design || ({} as CustomDesign);
      const design: CustomDesign = {
        occasionId: cfg.occasions.some((o) => o.id === d.occasionId) ? d.occasionId : cfg.occasions[0].id,
        sizeId: cfg.sizes.some((o) => o.id === d.sizeId) ? d.sizeId : cfg.sizes[0].id,
        flavourId: cfg.flavours.some((o) => o.id === d.flavourId) ? d.flavourId : cfg.flavours[0].id,
        colourId: cfg.colours.some((o) => o.id === d.colourId) ? d.colourId : cfg.colours[0].id,
        decorations: Array.isArray(d.decorations) ? d.decorations.filter((x) => cfg.decorations.some((c) => c.id === x)) : [],
        message: str(d.message, 22),
        date: /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : '',
      };
      lead = Math.max(lead, s.leadDays);
      const size = cfg.sizes.find((z) => z.id === design.sizeId)!;
      const occ = cfg.occasions.find((z) => z.id === design.occasionId)!;
      items.push({
        kind: 'custom',
        name: { ar: `Custom Cake · ${occ.name.ar} · ${size.name.ar}`, en: `Custom ${occ.name.en} cake · ${size.name.en}` },
        unitPrice: designPrice(cfg, design),
        qty,
        design,
        summary: designSummary(cfg, design),
        colour: cfg.colours.find((c) => c.id === design.colourId)?.base,
      });
    }
  }

  const name = str(raw.customer?.name, 80);
  if (name.length < 2) throw new OrderError('name', { ar: 'اكتب اسمك من فضلك.', en: 'Please enter your name.' });
  const phone = normalisePhone(toAscii(str(raw.customer?.phone, 30)));
  if (!/^01[0125]\d{8}$/.test(phone)) throw new OrderError('phone', { ar: 'رقم الموبايل لازم يكون ١١ رقم ويبدأ بـ 01.', en: 'Enter an 11-digit Egyptian mobile number starting with 01.' });
  const email = str(raw.customer?.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new OrderError('email', { ar: 'الإيميل مش مظبوط.', en: 'That email looks wrong.' });

  const f = raw.fulfillment || ({} as OrderInput['fulfillment']);
  const type = f.type === 'pickup' ? 'pickup' : 'delivery';
  if (type === 'delivery' && !s.deliveryEnabled) throw new OrderError('fulfillment', { ar: 'التوصيل مش متاح دلوقتي.', en: 'Delivery is unavailable right now.' });
  if (type === 'pickup' && !s.pickupEnabled) throw new OrderError('fulfillment', { ar: 'الاستلام مش متاح دلوقتي.', en: 'Pick-up is unavailable right now.' });
  let deliveryFee = 0;
  const fulfillment: Order['fulfillment'] = { type, date: '' };
  if (type === 'delivery') {
    const zone = s.zones.find((z) => z.id === f.zoneId && z.active);
    if (!zone) throw new OrderError('zone', { ar: 'اختار منطقة التوصيل.', en: 'Choose your delivery area.' });
    const address = str(f.address, 300);
    if (address.length < 6) throw new OrderError('address', { ar: 'اكتب العنوان بالتفصيل.', en: 'Please write the full address.' });
    deliveryFee = zone.fee;
    Object.assign(fulfillment, { zoneId: zone.id, zoneName: zone.name, address });
  }
  const date = str(f.date, 10);
  const minDate = isoDay(lead);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new OrderError('date', { ar: 'اختار يوم التسليم.', en: 'Pick a date.' });
  if (date < minDate) throw new OrderError('date', { ar: `أقرب ميعاد متاح للطلب ده بعد ${arCount(lead, 'day')} من النهارده.`, en: `The earliest date for this order is ${lead} days from today.` });
  fulfillment.date = date;
  const slot = s.timeSlots.find((x) => x.id === f.slotId);
  if (slot) Object.assign(fulfillment, { slotId: slot.id, slotName: slot.name });

  const method = (['cod', 'instapay', 'wallet'] as const).includes(raw.payment) ? raw.payment : 'cod';
  if (!s.payments[method]?.enabled) throw new OrderError('payment', { ar: 'طريقة الدفع دي مش متاحة.', en: 'That payment method is unavailable.' });

  const refImages = (Array.isArray(raw.refImages) ? raw.refImages : [])
    .filter((u): u is string => typeof u === 'string' && /^\/uploads\/ref-[a-z0-9]+-[a-z0-9]+\.(webp|jpg|png|avif)$/.test(u))
    .slice(0, 4);

  const subtotal = items.reduce((a, it) => a + it.unitPrice * it.qty, 0);
  const code = str(raw.coupon, 30).toUpperCase();
  const coupon = code ? db.coupons.find((c) => c.code.toUpperCase() === code) : undefined;
  const discount = couponDiscount(coupon, subtotal);
  if (coupon && discount > 0) coupon.uses += 1;

  db.counters.order += 1;
  const now = new Date().toISOString();
  return {
    id: shortId(12),
    code: 'PT-' + db.counters.order,
    createdAt: now,
    updatedAt: now,
    status: 'new',
    history: [{ status: 'new', at: now }],
    customer: { name, phone, ...(email ? { email } : {}) },
    fulfillment,
    items,
    subtotal,
    deliveryFee,
    discount,
    ...(discount > 0 ? { couponCode: coupon!.code } : {}),
    total: Math.max(0, subtotal + deliveryFee - discount),
    payment: { method, status: 'unpaid' },
    notes: str(raw.notes, 600) || undefined,
    ...(refImages.length ? { refImages } : {}),
    lang: raw.lang === 'en' ? 'en' : 'ar',
    seen: false,
  };
}

/** What a customer may see about their own order. */
export function publicOrder(o: Order) {
  const { adminNotes: _a, seen: _s, demo: _d, ...rest } = o;
  return { ...rest, customer: { name: o.customer.name, phone: o.customer.phone.replace(/^(\d{3})\d{5}(\d{3})$/, '$1•••••$2') } };
}
export type PublicOrder = ReturnType<typeof publicOrder>;
