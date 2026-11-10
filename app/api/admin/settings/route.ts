import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { cleanSettings } from '@/lib/sanitize';

export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const saved = await mutate((db) => {
    db.settings = cleanSettings(body, db.settings);
    return db.settings;
  });
  return Response.json(saved);
}
