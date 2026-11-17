import { readJson, TOO_BIG, tooBig } from '@/lib/body';
import { LIMITS } from '@/lib/limits';
import { mutate } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { createUserSession, getUser } from '@/lib/customer';
import { clientIp, MAX_PASSWORD, rateLimited, tooMany } from '@/lib/net';

/** Change the password, or set one for an account that was created with Google. */
export async function POST(req: Request) {
  const me = await getUser();
  if (!me) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (rateLimited('account-pw', me.id + ':' + clientIp(req), 10, 15 * 60_000)) return tooMany();
  const raw = await readJson(req, LIMITS.small);
  if (raw === TOO_BIG) return tooBig();
  const { current, next } = (raw ?? {}) as { current?: string; next?: string };
  if (me.passwordHash && (String(current || '').length > MAX_PASSWORD || !verifyPassword(String(current || ''), me.passwordHash))) return Response.json({ error: 'wrong' }, { status: 403 });
  if (!next || typeof next !== 'string' || next.length < 8 || next.length > MAX_PASSWORD) return Response.json({ error: 'short' }, { status: 422 });
  await mutate((db) => {
    const u = db.users.find((x) => x.id === me.id)!;
    u.passwordHash = hashPassword(next);
    u.sessions = []; // every other signed-in browser is revoked; this one gets a fresh session below
  });
  // Older sessions (other devices) are now invalid; keep this one signed in.
  await createUserSession(me.id);
  return Response.json({ ok: true });
}
