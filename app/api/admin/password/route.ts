import { mutate, readDB } from '@/lib/db';
import { createSessionCookie, isAdmin, unauthorized } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { MAX_PASSWORD } from '@/lib/net';

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { current, next } = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
  const db = await readDB();
  if (!current || typeof current !== 'string' || current.length > MAX_PASSWORD || !verifyPassword(current, db.admin.passwordHash)) return Response.json({ error: 'wrong' }, { status: 403 });
  if (!next || typeof next !== 'string' || next.length < 8 || next.length > MAX_PASSWORD) return Response.json({ error: 'short' }, { status: 422 });
  await mutate((d) => {
    d.admin.passwordHash = hashPassword(next);
  });
  // Every older session is now invalid; keep this one signed in.
  await createSessionCookie();
  return Response.json({ ok: true });
}
