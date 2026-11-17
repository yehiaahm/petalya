import { readJson, TOO_BIG, tooBig } from '@/lib/body';
import { LIMITS } from '@/lib/limits';
import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { cleanGallery } from '@/lib/sanitize';

export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const raw = await readJson(req, LIMITS.adminJson);
  if (raw === TOO_BIG) return tooBig();
  const list = cleanGallery(raw);
  const saved = await mutate((db) => {
    db.gallery = list;
    return db.gallery;
  });
  return Response.json(saved);
}
