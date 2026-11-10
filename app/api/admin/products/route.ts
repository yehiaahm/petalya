import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { cleanProduct } from '@/lib/sanitize';
import type { Product } from '@/lib/types';

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const p = cleanProduct((await req.json().catch(() => ({}))) as Partial<Product>);
  if (!p.name.ar) return Response.json({ error: 'name' }, { status: 422 });
  const saved = await mutate((db) => {
    if (!db.categories.some((c) => c.id === p.categoryId)) p.categoryId = db.categories[0]?.id ?? '';
    p.sort = db.products.filter((x) => x.categoryId === p.categoryId).length;
    db.products.push(p);
    return p;
  });
  return Response.json(saved);
}

/** Reorder: body = { ids } in the new order. */
export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
  if (!Array.isArray(ids)) return Response.json({ error: 'ids' }, { status: 422 });
  await mutate((db) => {
    ids.forEach((id, i) => {
      const p = db.products.find((x) => x.id === id);
      if (p) p.sort = i;
    });
  });
  return Response.json({ ok: true });
}
