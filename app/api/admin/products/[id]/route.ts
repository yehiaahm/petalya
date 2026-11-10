import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { cleanProduct } from '@/lib/sanitize';
import type { Product } from '@/lib/types';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Partial<Product>;
  const saved = await mutate((db) => {
    const i = db.products.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const merged = cleanProduct({ ...db.products[i], ...body }, db.products[i]);
    if (!db.categories.some((c) => c.id === merged.categoryId)) merged.categoryId = db.products[i].categoryId;
    db.products[i] = merged;
    return merged;
  });
  if (!saved) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json(saved);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  await mutate((db) => {
    db.products = db.products.filter((x) => x.id !== id);
  });
  return Response.json({ ok: true });
}
