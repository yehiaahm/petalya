import { readJson, TOO_BIG, tooBig } from '@/lib/body';
import { LIMITS } from '@/lib/limits';
import { mutate, readDB } from '@/lib/db';
import { createSessionCookie, isAdmin, rememberAdminDevice, unauthorized } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { MAX_PASSWORD } from '@/lib/net';

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const raw = await readJson(req, LIMITS.small);
  if (raw === TOO_BIG) return tooBig();
  const { current, next } = (raw ?? {}) as { current?: string; next?: string };
  const db = await readDB();
  if (!current || typeof current !== 'string' || current.length > MAX_PASSWORD || !verifyPassword(current, db.admin.passwordHash)) return Response.json({ error: 'wrong' }, { status: 403 });
  if (!next || typeof next !== 'string' || next.length < 8 || next.length > MAX_PASSWORD) return Response.json({ error: 'short' }, { status: 422 });
  await mutate((d) => {
    d.admin.passwordHash = hashPassword(next);
    d.admin.sessions = []; // every other signed-in browser is revoked; this one gets a fresh session below
  });
  // Every older session and trusted device is now invalid; keep this browser signed in and trusted.
  await createSessionCookie();
  await rememberAdminDevice();
  return Response.json({ ok: true });
}
