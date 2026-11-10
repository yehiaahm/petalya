import { mutate, readDB } from '@/lib/db';
import { verifyPassword } from '@/lib/crypto';
import { createUserSession, normEmail, publicUser } from '@/lib/customer';
import { loginBlocked, loginFailed, loginOk } from '@/lib/auth';
import { clientIp, MAX_PASSWORD } from '@/lib/net';

export async function POST(req: Request) {
  const ip = 'user:' + clientIp(req);
  if (loginBlocked(ip)) return Response.json({ error: 'rate', message: { ar: 'محاولات كتير — جرّب بعد دقيقة.', en: 'Too many attempts — try again in a minute.' } }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = normEmail(b.email);
  const pw = String(b.password || '').slice(0, MAX_PASSWORD + 1);
  const db = await readDB();
  const u = db.users.find((x) => x.email === email);
  if (!u || !u.passwordHash || !verifyPassword(pw, u.passwordHash)) {
    loginFailed(ip);
    await new Promise((r) => setTimeout(r, 350));
    const google = u && !u.passwordHash;
    return Response.json(
      {
        error: 'credentials',
        message: google
          ? { ar: 'الحساب ده متعمل بجوجل — ادخل بزرار جوجل.', en: 'This account uses Google — continue with Google.' }
          : { ar: 'الإيميل أو كلمة السر غلط.', en: 'Wrong email or password.' },
      },
      { status: 401 },
    );
  }
  loginOk(ip);
  await mutate((d) => {
    const x = d.users.find((y) => y.id === u.id);
    if (x) x.lastLoginAt = new Date().toISOString();
  });
  await createUserSession(u.id);
  return Response.json({ user: publicUser(u) });
}
