import content from './content.json';
import type { DB, Order, OrderStatus, Product, Settings } from './types';
import { hashPassword, randomSecret } from './crypto';

const now = () => new Date().toISOString();
const img = (p: string | null | undefined) => (p ? '/' + p.replace(/^\/?/, '') : '');

export function defaultSettings(): Settings {
  const b = content.builderOptions;
  return {
    whatsapp: content.brand.whatsappNumber,
    instagramUrl: content.brand.instagramUrl,
    instagramHandle: content.brand.instagramHandle,
    storeOpen: true,
    showPrices: false,
    closedMessage: {
      ar: 'بناخد إجازة قصيرة — الطلبات هترجع قريب جدًا.',
      en: 'We are taking a short break — orders will reopen very soon.',
    },
    leadDays: b.rules.minLeadDays,
    standardLeadDays: 1,
    deliveryEnabled: true,
    pickupEnabled: true,
    pickupAddress: { ar: 'مطبخ Petalya — بميعاد مسبق', en: 'Petalya kitchen — by appointment' },
    zones: [
      { id: 'z-nasr', name: { ar: 'مدينة نصر', en: 'Nasr City' }, fee: 60, active: true },
      { id: 'z-heliopolis', name: { ar: 'مصر الجديدة', en: 'Heliopolis' }, fee: 60, active: true },
      { id: 'z-maadi', name: { ar: 'المعادي', en: 'Maadi' }, fee: 80, active: true },
      { id: 'z-newcairo', name: { ar: 'التجمع الخامس', en: 'New Cairo' }, fee: 90, active: true },
      { id: 'z-dokki', name: { ar: 'الدقي والمهندسين', en: 'Dokki & Mohandessin' }, fee: 80, active: true },
      { id: 'z-october', name: { ar: '٦ أكتوبر والشيخ زايد', en: '6th of October & Zayed' }, fee: 120, active: true },
    ],
    timeSlots: [
      { id: 'morning', name: { ar: 'الصبح (١٠ – ١٢)', en: 'Morning (10 – 12)' } },
      { id: 'afternoon', name: { ar: 'الضهر (١٢ – ٤)', en: 'Afternoon (12 – 4)' } },
      { id: 'evening', name: { ar: 'بالليل (٤ – ٩)', en: 'Evening (4 – 9)' } },
    ],
    payments: {
      cod: { enabled: true },
      instapay: { enabled: true, handle: 'petalya@instapay' },
      wallet: { enabled: true, number: '01000000000' },
    },
    builder: {
      enabled: true,
      occasions: b.occasions.map((o, i) => ({ id: 'o' + (i + 1), name: { ar: o.ar, en: o.en }, topper: o.topper })),
      sizes: b.sizes.map((s, i) => ({ id: 's' + (i + 1), tiers: s.tiers, price: s.price, name: { ar: s.ar, en: s.en }, serves: s.serves })),
      flavours: b.flavours.map((f, i) => ({ id: 'f' + (i + 1), name: { ar: f.ar, en: f.en }, surcharge: f.surchargePerTier })),
      colours: b.frostingColours.map((c, i) => ({
        id: 'c' + (i + 1),
        name: { ar: c.ar, en: c.en },
        base: c.base,
        light: c.light,
        dark: c.dark,
        ...('messageColour' in c && c.messageColour ? { messageColour: c.messageColour as string } : {}),
      })),
      decorations: b.decorations.map((d) => ({ id: d.id, icon: d.icon, price: d.price, perTier: d.perTier, name: { ar: d.ar, en: d.en } })),
    },
  };
}

const DEFAULT_ADMIN_PASSWORD = 'petalya-admin';

/** The very first admin password. In production it must be set explicitly — never fall back to a known default. */
function initialAdminPassword() {
  const pw = process.env.ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production') {
    if (!pw || pw === DEFAULT_ADMIN_PASSWORD || pw === 'change-me' || pw.length < 10) {
      throw new Error('ADMIN_PASSWORD must be set (at least 10 characters, not the default) before the first start in production.');
    }
    return pw;
  }
  return pw || DEFAULT_ADMIN_PASSWORD;
}

export function createSeed(): DB {
  const t = now();
  const categories = content.menu.map((m, i) => ({ id: m.id, name: { ar: m.ar, en: m.en }, sort: i }));
  const products: Product[] = [];
  content.menu.forEach((m) =>
    m.items.forEach((it, i) =>
      products.push({
        id: it.id,
        categoryId: m.id,
        name: { ar: it.ar.name, en: it.en.name },
        desc: { ar: it.ar.desc, en: it.en.desc },
        price: it.price,
        compareAt: null,
        images: it.images.map(img),
        active: true,
        featured: i === 0,
        soldOut: false,
        leadDays: m.id === 'cakes' ? content.builderOptions.rules.minLeadDays : null,
        sort: i,
        createdAt: t,
        updatedAt: t,
      }),
    ),
  );
  return {
    version: 1,
    categories,
    products,
    gallery: content.gallery.map((g, i) => ({
      id: g.id,
      image: img(g.image),
      productId: g.productId,
      tilt: g.tilt,
      title: { ar: g.ar.title, en: g.en.title },
      occasion: { ar: g.ar.occasion, en: g.en.occasion },
      note: { ar: g.ar.note, en: g.en.note },
      active: true,
      sort: i,
    })),
    reviews: content.reviews.map((r, i) => ({
      id: 'r' + (i + 1),
      name: { ar: r.ar.name, en: r.en.name },
      occasion: { ar: r.ar.occasion, en: r.en.occasion },
      quote: { ar: r.ar.quote, en: r.en.quote },
      rating: 5,
      status: 'approved' as const,
      createdAt: t,
    })),
    coupons: [
      { id: 'cp1', code: 'PETALYA10', type: 'percent', value: 10, minSubtotal: 500, active: true, uses: 0, maxUses: null, expiresAt: null, createdAt: t },
    ],
    orders: [],
    settings: defaultSettings(),
    admin: {
      passwordHash: hashPassword(initialAdminPassword()),
      // Used to sign sessions only when SESSION_SECRET is not set; never copy the env value into the data file.
      secret: randomSecret(),
    },
    counters: { order: 1000 },
    users: [],
  };
}

/* ---------- Demo data so the dashboard looks alive on first run (removable from Settings) ---------- */

const DEMO_NAMES = ['منة أحمد', 'سارة محمود', 'نور الهدى', 'ياسمين علي', 'مريم خالد', 'هبة سمير', 'دينا مصطفى', 'رنا عادل', 'آية حسن', 'فرح طارق', 'Laila Hassan', 'Nada Fathy', 'ملك إبراهيم', 'جنى وليد'];

export function demoOrders(db: DB, count = 46): Order[] {
  const prods = db.products.filter((p) => p.active);
  const zones = db.settings.zones;
  const out: Order[] = [];
  const rnd = (n: number) => Math.floor(Math.random() * n);
  const statuses: OrderStatus[] = ['delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'ready', 'preparing', 'confirmed', 'new', 'cancelled'];
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.pow(Math.random(), 1.4) * 58);
    const created = new Date(Date.now() - daysAgo * 864e5 - rnd(10 * 3600e3));
    const n = 1 + rnd(3);
    const items = Array.from({ length: n }, () => {
      const p = prods[rnd(prods.length)];
      return { kind: 'product' as const, productId: p.id, name: p.name, image: p.images[0], unitPrice: p.price, qty: 1 + rnd(2) };
    });
    const subtotal = items.reduce((a, it) => a + it.unitPrice * it.qty, 0);
    const pickup = Math.random() < 0.25;
    const zone = zones[rnd(zones.length)];
    const fee = pickup ? 0 : zone.fee;
    let status: OrderStatus = daysAgo > 4 ? statuses[rnd(statuses.length)] : (['new', 'confirmed', 'preparing', 'ready'] as OrderStatus[])[rnd(4)];
    if (daysAgo > 4 && status !== 'cancelled') status = 'delivered';
    const deliveryDate = new Date(created.getTime() + (2 + rnd(4)) * 864e5).toISOString().slice(0, 10);
    const name = DEMO_NAMES[rnd(DEMO_NAMES.length)];
    const code = 'PT-D' + (101 + i);
    out.push({
      id: 'demo-' + code,
      code,
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
      status,
      history: [{ status: 'new', at: created.toISOString() }, ...(status !== 'new' ? [{ status, at: new Date(created.getTime() + 3600e3).toISOString() }] : [])],
      customer: { name, phone: '010' + String(10000000 + rnd(89999999)) },
      fulfillment: pickup
        ? { type: 'pickup', date: deliveryDate, slotId: 'afternoon', slotName: db.settings.timeSlots[1].name }
        : { type: 'delivery', zoneId: zone.id, zoneName: zone.name, address: 'شارع ' + (10 + rnd(90)) + '، عمارة ' + (1 + rnd(30)), date: deliveryDate, slotId: 'evening', slotName: db.settings.timeSlots[2].name },
      items,
      subtotal,
      deliveryFee: fee,
      discount: 0,
      total: subtotal + fee,
      payment: { method: (['cod', 'cod', 'instapay', 'wallet'] as const)[rnd(4)], status: status === 'delivered' ? 'paid' : 'unpaid' },
      lang: Math.random() < 0.85 ? 'ar' : 'en',
      seen: daysAgo > 0,
      demo: true,
    });
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
