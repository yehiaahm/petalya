import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { cleanReviews } from '@/lib/sanitize';

export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const list = cleanReviews(await req.json().catch(() => null));
  const saved = await mutate((db) => {
    db.reviews = list;
    return db.reviews;
  });
  return Response.json(saved);
}
