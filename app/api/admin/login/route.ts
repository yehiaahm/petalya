import { readDB } from '@/lib/db';
import { verifyPassword } from '@/lib/crypto';
import { createSessionCookie, loginBlocked, loginFailed, loginOk } from '@/lib/auth';
import { clientIp, MAX_PASSWORD, rateLimited, tooMany } from '@/lib/net';

export async function POST(req: Request) {
  const ip = 'admin:' + clientIp(req);
  // Per-visitor lockout, plus a global ceiling so spoofed addresses can't be used to keep guessing.
  if (loginBlocked(ip) || rateLimited('admin-login-all', 'all', 60, 10 * 60_000)) return tooMany();
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const db = await readDB();
  if (!password || typeof password !== 'string' || password.length > MAX_PASSWORD || !verifyPassword(password, db.admin.passwordHash)) {
    loginFailed(ip);
    await new Promise((r) => setTimeout(r, 400));
    return Response.json({ error: 'wrong' }, { status: 401 });
  }
  loginOk(ip);
  await createSessionCookie();
  return Response.json({ ok: true });
}
