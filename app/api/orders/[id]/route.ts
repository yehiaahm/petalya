import { readDB } from '@/lib/db';
import { publicOrder } from '@/lib/orders';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await readDB();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(publicOrder(o), { headers: { 'cache-control': 'no-store' } });
}
