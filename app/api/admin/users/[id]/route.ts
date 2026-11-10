import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { hashPassword, shortId } from '@/lib/crypto';

/** Reset a customer's password to a one-off temporary one the shop can send them. */
export async function PATCH(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const temp = shortId(10);
  const ok = await mutate((db) => {
    const u = db.users.find((x) => x.id === id);
    if (!u) return false;
    u.passwordHash = hashPassword(temp);
    return true;
  });
  if (!ok) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ password: temp });
}

/** Delete the account. Their orders stay (unlinked) for the shop's records. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  await mutate((db) => {
    db.users = db.users.filter((x) => x.id !== id);
    db.orders.forEach((o) => {
      if (o.userId === id) delete o.userId;
    });
  });
  return Response.json({ ok: true });
}
