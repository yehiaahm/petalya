import 'server-only';
import type { DB, Order, TrackEvent } from './types';

const DAY = 864e5;
const dayKey = (t: number | string) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const startOfDay = (t = Date.now()) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const live = (o: Order) => o.status !== 'cancelled';

export type Series = { day: string; revenue: number; orders: number; visitors: number }[];

export function computeStats(db: DB, events: TrackEvent[], days = 30) {
  const today = startOfDay();
  const from = today - (days - 1) * DAY;
  const prevFrom = from - days * DAY;
  const inRange = (t: number, a: number, b: number) => t >= a && t < b;
  const tOf = (o: Order) => new Date(o.createdAt).getTime();

  const cur = db.orders.filter((o) => live(o) && tOf(o) >= from);
  const prev = db.orders.filter((o) => live(o) && inRange(tOf(o), prevFrom, from));
  const sum = (l: Order[]) => l.reduce((a, o) => a + o.total, 0);
  const visitorsIn = (a: number, b: number) => new Set(events.filter((e) => e.type === 'page_view' && inRange(e.t, a, b)).map((e) => e.sid || String(e.t))).size;
  const vCur = visitorsIn(from, today + DAY), vPrev = visitorsIn(prevFrom, from);
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);

  // daily series (90 days so the chart can switch ranges client-side)
  const series: Series = [];
  const map = new Map<string, Series[number]>();
  for (let i = 89; i >= 0; i--) {
    const k = dayKey(today - i * DAY);
    const row = { day: k, revenue: 0, orders: 0, visitors: 0 };
    series.push(row);
    map.set(k, row);
  }
  db.orders.filter(live).forEach((o) => {
    const r = map.get(dayKey(o.createdAt));
    if (r) {
      r.revenue += o.total;
      r.orders += 1;
    }
  });
  const seen = new Map<string, Set<string>>();
  events.forEach((e) => {
    if (e.type !== 'page_view') return;
    const k = dayKey(e.t);
    if (!map.has(k)) return;
    if (!seen.has(k)) seen.set(k, new Set());
    seen.get(k)!.add(e.sid || String(e.t));
  });
  seen.forEach((s, k) => (map.get(k)!.visitors = s.size));

  const statusCounts: Record<string, number> = {};
  db.orders.forEach((o) => (statusCounts[o.status] = (statusCounts[o.status] || 0) + 1));

  const top = new Map<string, { name: string; qty: number; revenue: number; image?: string }>();
  cur.forEach((o) =>
    o.items.forEach((it) => {
      const k = it.kind === 'custom' ? 'custom' : it.productId || it.name.ar;
      const name = it.kind === 'custom' ? 'تورت حسب الطلب («صمّم تورتتك»)' : it.name.ar;
      const row = top.get(k) || { name, qty: 0, revenue: 0, image: it.image };
      row.qty += it.qty;
      row.revenue += it.qty * it.unitPrice;
      top.set(k, row);
    }),
  );

  const upcoming = Array.from({ length: 7 }, (_, i) => {
    const k = dayKey(today + i * DAY);
    const list = db.orders.filter((o) => o.fulfillment.date === k && o.status !== 'cancelled' && o.status !== 'delivered');
    return { day: k, count: list.length, total: sum(list) };
  });

  const ev = events.filter((e) => e.t >= from);
  const sess = (type: string) => new Set(ev.filter((e) => e.type === type).map((e) => e.sid || String(e.t))).size;
  const funnel = [
    { k: 'زيارات', v: sess('page_view') },
    { k: 'أضافوا منتجًا للطلب', v: sess('add_to_cart') },
    { k: 'فتحوا صفحة إتمام الطلب', v: sess('checkout_start') },
    { k: 'أتمّوا الطلب', v: cur.length },
  ];
  const count = (pick: (e: TrackEvent) => string | undefined, filter: (e: TrackEvent) => boolean) => {
    const m = new Map<string, number>();
    ev.filter(filter).forEach((e) => {
      const k = pick(e);
      if (k) m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v }));
  };
  const sources = count((e) => e.ref || 'مباشر / واتساب', (e) => e.type === 'page_view');
  const devices = count((e) => e.device, (e) => e.type === 'page_view');
  const wa = count((e) => String(e.meta?.source ?? ''), (e) => e.type === 'whatsapp_click');
  const added = count((e) => String(e.meta?.product ?? ''), (e) => e.type === 'add_to_cart');

  return {
    days,
    revenue: { v: sum(cur), d: pct(sum(cur), sum(prev)) },
    orders: { v: cur.length, d: pct(cur.length, prev.length) },
    aov: { v: cur.length ? Math.round(sum(cur) / cur.length) : 0, d: pct(cur.length ? sum(cur) / cur.length : 0, prev.length ? sum(prev) / prev.length : 0) },
    visitors: { v: vCur, d: pct(vCur, vPrev) },
    conversion: vCur ? Math.round((cur.length / vCur) * 1000) / 10 : 0,
    todayOrders: db.orders.filter((o) => tOf(o) >= today).length,
    todayRevenue: sum(db.orders.filter((o) => live(o) && tOf(o) >= today)),
    unpaid: sum(db.orders.filter((o) => live(o) && o.payment.status === 'unpaid' && o.status !== 'new')),
    series,
    statusCounts,
    top: [...top.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    upcoming,
    funnel,
    sources: sources.slice(0, 8),
    devices,
    wa,
    added: added.slice(0, 10),
    customers: new Set(db.orders.map((o) => o.customer.phone)).size,
  };
}
export type Stats = ReturnType<typeof computeStats>;
