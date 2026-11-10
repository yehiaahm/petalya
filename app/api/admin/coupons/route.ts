import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { cleanCoupons } from '@/lib/sanitize';

export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const list = cleanCoupons(await req.json().catch(() => null));
  const saved = await mutate((db) => {
    db.coupons = list;
    return db.coupons;
  });
  return Response.json(saved);
}
