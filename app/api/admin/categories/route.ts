import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { cleanCategories } from '@/lib/sanitize';

export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const list = cleanCategories(await req.json().catch(() => null));
  const saved = await mutate((db) => {
    db.categories = list;
    return db.categories;
  });
  return Response.json(saved);
}
