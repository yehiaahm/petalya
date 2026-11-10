import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import type { OrderStatus } from '@/lib/types';

const ST: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { status?: OrderStatus; note?: string; paid?: boolean; adminNotes?: string; seen?: boolean; quote?: { total?: number; note?: string } };
  const o = await mutate((db) => {
    const o = db.orders.find((x) => x.id === id);
    if (!o) return null;
    const now = new Date().toISOString();
    if (b.status && ST.includes(b.status) && b.status !== o.status) {
      o.status = b.status;
      o.history.push({ status: b.status, at: now, ...(b.note ? { note: String(b.note).slice(0, 200) } : {}) });
      if (b.status === 'delivered' && o.payment.method === 'cod') o.payment.status = 'paid';
    }
    if (b.quote && Number.isFinite(Number(b.quote.total)) && Number(b.quote.total) >= 0) {
      const total = Math.round(Number(b.quote.total));
      const note = typeof b.quote.note === 'string' ? b.quote.note.trim().slice(0, 300) : '';
      o.quote = { total, at: now, ...(note ? { note } : {}) };
      o.total = total;
      if (o.status === 'new') {
        o.status = 'confirmed';
        o.history.push({ status: 'confirmed', at: now, note: 'تم تأكيد السعر' });
      }
    }
    if (typeof b.paid === 'boolean') o.payment.status = b.paid ? 'paid' : 'unpaid';
    if (typeof b.adminNotes === 'string') o.adminNotes = b.adminNotes.slice(0, 2000);
    if (typeof b.seen === 'boolean') o.seen = b.seen;
    o.updatedAt = now;
    return o;
  });
  if (!o) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(o);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  await mutate((db) => {
    db.orders = db.orders.filter((x) => x.id !== id);
  });
  return Response.json({ ok: true });
}
