import { mutate } from '@/lib/db';
import { shortId } from '@/lib/crypto';
import { clientIp, rateLimited, tooMany } from '@/lib/net';

export async function POST(req: Request) {
  if (rateLimited('reviews', clientIp(req), 10, 60 * 60_000)) return tooMany();
  const b = (await req.json().catch(() => ({}))) as { orderId?: string; rating?: number; quote?: string };
  const quote = String(b.quote || '').trim().slice(0, 400);
  const rating = Math.max(1, Math.min(5, Math.round(Number(b.rating) || 5)));
  if (quote.length < 4) return Response.json({ error: 'quote' }, { status: 422 });
  const res = await mutate((db) => {
    const o = db.orders.find((x) => x.id === b.orderId);
    if (!o || o.status !== 'delivered') return 'not_allowed';
    if (db.reviews.some((r) => r.orderCode === o.code)) return 'exists';
    const first = o.customer.name.split(/\s+/)[0];
    const occ = o.items.find((i) => i.kind === 'custom')?.summary?.[0]?.v ?? o.items[0]?.name ?? { ar: '', en: '' };
    db.reviews.push({ id: shortId(8), name: { ar: first, en: first }, occasion: occ, quote: { ar: quote, en: quote }, rating, status: 'pending', orderCode: o.code, createdAt: new Date().toISOString() });
    return 'ok';
  });
  if (res !== 'ok') return Response.json({ error: res }, { status: 409 });
  return Response.json({ ok: true });
}
