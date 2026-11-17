import { readJson, TOO_BIG, tooBig } from '@/lib/body';
import { LIMITS } from '@/lib/limits';
import { mutate, readDB } from '@/lib/db';
import { safeEqual, verifyPassword } from '@/lib/crypto';
import { createUserSession, normEmail, publicUser } from '@/lib/customer';
import { adminLoginBlocked, adminLoginFailed, adminLoginSucceeded, adminUsername, loginBlocked, loginFailed, loginOk } from '@/lib/auth';
import { clientIp, MAX_PASSWORD, tooMany } from '@/lib/net';

export async function POST(req: Request) {
  const ip = 'user:' + clientIp(req);
  if (loginBlocked(ip)) return Response.json({ error: 'rate', message: { ar: 'محاولات كتير — جرّب تاني بعد دقيقة.', en: 'Too many attempts — try again in a minute.' } }, { status: 429 });
  const raw = await readJson(req, LIMITS.small);
  if (raw === TOO_BIG) return tooBig();
  const b = (raw ?? {}) as { email?: string; password?: string };
  const email = normEmail(b.email);
  const pw = String(b.password || '').slice(0, MAX_PASSWORD + 1);
  // Per-account lockout on top of the per-client one: guessing one account's password from many
  // different addresses must not get unlimited tries. Cleared by a successful sign-in.
  // NOT applied to the admin name: that name is handled by the admin throttle below, and a per-name lock would let
  // anyone lock the owner out of this form with five wrong tries (PT-03).
  const adminName = safeEqual(email, adminUsername().toLowerCase());
  const acct = 'acct:' + email;
  if (email && !adminName && loginBlocked(acct)) return Response.json({ error: 'rate', message: { ar: 'محاولات كتير — جرّب تاني بعد دقيقة.', en: 'Too many attempts — try again in a minute.' } }, { status: 429 });
  const db = await readDB();

  // The admin name typed into the customer form (e.g. "admin"): sign in to the panel instead,
  // under the same throttle as /api/admin/login so this isn't a side door.
  if (pw && adminName) {
    const adminIp = 'admin:' + clientIp(req);
    if (await adminLoginBlocked(adminIp)) return tooMany();
    if (pw.length <= MAX_PASSWORD && verifyPassword(pw, db.admin.passwordHash)) {
      loginOk(ip);
      await adminLoginSucceeded(adminIp);
      return Response.json({ admin: true, redirect: '/admin' });
    }
    adminLoginFailed(adminIp);
  }

  const u = db.users.find((x) => x.email === email);
  if (!u || !u.passwordHash || !verifyPassword(pw, u.passwordHash)) {
    loginFailed(ip);
    if (email && !adminName) loginFailed(acct);
    await new Promise((r) => setTimeout(r, 350));
    const google = u && !u.passwordHash;
    return Response.json(
      {
        error: 'credentials',
        message: google
          ? { ar: 'الحساب ده متسجّل بـ Google — ادخل من زرار Google.', en: 'This account uses Google — continue with Google.' }
          : { ar: 'الإيميل أو الباسورد غلط.', en: 'Wrong email or password.' },
      },
      { status: 401 },
    );
  }
  loginOk(ip);
  loginOk(acct);
  await mutate((d) => {
    const x = d.users.find((y) => y.id === u.id);
    if (x) x.lastLoginAt = new Date().toISOString();
  });
  await createUserSession(u.id);
  return Response.json({ user: publicUser(u) });
}
