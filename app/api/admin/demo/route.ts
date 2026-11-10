import { mutate, appendEvents, rewriteEvents } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { demoOrders } from '@/lib/seed';
import type { TrackEvent } from '@/lib/types';

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action === 'clear') {
    await mutate((db) => {
      db.orders = db.orders.filter((o) => !o.demo);
    });
    await rewriteEvents((e) => !e.demo);
    return Response.json({ ok: true });
  }
  const orders = await mutate((db) => {
    db.orders = db.orders.filter((o) => !o.demo);
    const list = demoOrders(db);
    db.orders.push(...list);
    db.orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return list;
  });
  await rewriteEvents((e) => !e.demo);
  // Synthetic traffic roughly in line with the demo orders.
  const ev: TrackEvent[] = [];
  const refs = ['instagram.com', 'instagram.com', 'instagram.com', 'facebook.com', 'google.com', '', '', 'tiktok.com'];
  const devs = ['mobile', 'mobile', 'mobile', 'mobile', 'desktop', 'tablet'] as const;
  for (let d = 0; d < 60; d++) {
    const n = 18 + Math.round(Math.random() * 40 * (1 + Math.sin(d / 5)));
    for (let i = 0; i < n; i++) {
      const t = Date.now() - d * 864e5 - Math.random() * 864e5;
      const base = { sid: `demo${d}-${i}`, demo: true, device: devs[i % devs.length], ref: refs[i % refs.length] || undefined };
      ev.push({ t, type: 'page_view', path: '/', ...base });
      if (Math.random() < 0.32) ev.push({ t: t + 6e4, type: 'add_to_cart', ...base, meta: { product: ['c1', 'c2', 'u1', 'b1', 'b2', 'custom-cake'][i % 6] } });
      if (Math.random() < 0.13) ev.push({ t: t + 9e4, type: 'checkout_start', ...base });
      if (Math.random() < 0.1) ev.push({ t: t + 3e4, type: 'whatsapp_click', ...base, meta: { source: ['fab', 'gallery', 'header', 'builder', 'contact', 'links'][i % 6] } });
    }
  }
  ev.sort((a, b) => a.t - b.t);
  await appendEvents(ev);
  return Response.json({ ok: true, orders: orders.length });
}
