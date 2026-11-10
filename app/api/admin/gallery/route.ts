import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { cleanGallery } from '@/lib/sanitize';

export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const list = cleanGallery(await req.json().catch(() => null));
  const saved = await mutate((db) => {
    db.gallery = list;
    return db.gallery;
  });
  return Response.json(saved);
}
