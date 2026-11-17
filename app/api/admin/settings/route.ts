import { readJson, TOO_BIG, tooBig } from '@/lib/body';
import { LIMITS } from '@/lib/limits';
import { mutate } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { cleanSettings } from '@/lib/sanitize';

export async function PUT(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const raw = await readJson(req, LIMITS.adminJson);
  if (raw === TOO_BIG) return tooBig();
  const body = (raw ?? {}) as Parameters<typeof cleanSettings>[0];
  const saved = await mutate((db) => {
    db.settings = cleanSettings(body, db.settings);
    return db.settings;
  });
  return Response.json(saved);
}
