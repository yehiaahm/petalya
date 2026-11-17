import { readJson, TOO_BIG, tooBig } from '@/lib/body';
import { LIMITS } from '@/lib/limits';
import { readDB } from '@/lib/db';
import { verifyPassword } from '@/lib/crypto';
import { adminLoginBlocked, adminLoginFailed, adminLoginSucceeded, adminUsername } from '@/lib/auth';
import { safeEqual } from '@/lib/crypto';
import { clientIp, MAX_PASSWORD, tooMany } from '@/lib/net';

export async function POST(req: Request) {
  const ip = 'admin:' + clientIp(req);
  // Per-client lockout, plus a global ceiling on wrong guesses that applies to unrecognised browsers only,
  // so strangers cannot lock the owner out (PT-03). See adminLoginBlocked in lib/auth.ts.
  if (await adminLoginBlocked(ip)) return tooMany();
  const raw = await readJson(req, LIMITS.small);
  if (raw === TOO_BIG) return tooBig();
  const { username, password } = (raw ?? {}) as { username?: string; password?: string };
  const db = await readDB();
  const name = typeof username === 'string' ? username.trim().slice(0, 60).toLowerCase() : '';
  // Check both every time so a wrong name and a wrong password look (and time) the same.
  const nameOk = safeEqual(name, adminUsername().toLowerCase());
  const passOk = !!password && typeof password === 'string' && password.length <= MAX_PASSWORD && verifyPassword(password, db.admin.passwordHash);
  if (!nameOk || !passOk) {
    adminLoginFailed(ip);
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: 'wrong' }, { status: 401 });
  }
  await adminLoginSucceeded(ip);
  return Response.json({ ok: true });
}
