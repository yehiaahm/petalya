import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { cleanReviewShots } from '@/lib/sanitize';

export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const list = cleanReviewShots(await req.json().catch(() => null));
  const saved = await mutate((db) => {
    db.reviewShots = list;
    return db.reviewShots;
  });
  return Response.json(saved);
}
