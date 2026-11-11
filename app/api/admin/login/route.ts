import { readDB } from '@/lib/db';
import { verifyPassword } from '@/lib/crypto';
import { adminUsername, createSessionCookie, loginBlocked, loginFailed, loginOk } from '@/lib/auth';
import { safeEqual } from '@/lib/crypto';
import { clientIp, MAX_PASSWORD, rateLimited, tooMany } from '@/lib/net';

export async function POST(req: Request) {
  const ip = 'admin:' + clientIp(req);
  // Per-visitor lockout, plus a global ceiling so spoofed addresses can't be used to keep guessing.
  if (loginBlocked(ip) || rateLimited('admin-login-all', 'all', 60, 10 * 60_000)) return tooMany();
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const db = await readDB();
  const name = typeof username === 'string' ? username.trim().slice(0, 60).toLowerCase() : '';
  // Check both every time so a wrong name and a wrong password look (and time) the same.
  const nameOk = safeEqual(name, adminUsername().toLowerCase());
  const passOk = !!password && typeof password === 'string' && password.length <= MAX_PASSWORD && verifyPassword(password, db.admin.passwordHash);
  if (!nameOk || !passOk) {
    loginFailed(ip);
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: 'wrong' }, { status: 401 });
  }
  loginOk(ip);
  await createSessionCookie();
  return Response.json({ ok: true });
}
