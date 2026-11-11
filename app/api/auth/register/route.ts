import { mutate } from '@/lib/db';
import { hashPassword, shortId } from '@/lib/crypto';
import { createUserSession, normEmail, publicUser, validEmail } from '@/lib/customer';
import { loginBlocked, loginFailed } from '@/lib/auth';
import { clientIp, MAX_PASSWORD, rateLimited } from '@/lib/net';
import type { User } from '@/lib/types';

const err = (field: string, ar: string, en: string, status = 422) => Response.json({ error: field, message: { ar, en } }, { status });

export async function POST(req: Request) {
  const ip = 'reg:' + clientIp(req);
  if (loginBlocked(ip) || rateLimited('register', ip, 10, 60 * 60_000)) return err('rate', 'محاولات كثيرة. حاول مرة أخرى بعد دقيقة.', 'Too many attempts — try again in a minute.', 429);
  const b = (await req.json().catch(() => ({}))) as { name?: string; email?: string; password?: string };
  const name = String(b.name || '').trim().slice(0, 80);
  const email = normEmail(b.email);
  const password = String(b.password || '');
  if (password.length > MAX_PASSWORD) return err('password', 'كلمة المرور طويلة جدًا.', 'That password is too long.');
  if (name.length < 2) return err('name', 'من فضلك اكتب اسمك.', 'Please enter your name.');
  if (!validEmail(email)) return err('email', 'البريد الإلكتروني غير صحيح.', 'That email looks wrong.');
  if (password.length < 8) return err('password', 'يجب ألا تقل كلمة المرور عن ٨ أحرف.', 'Password must be at least 8 characters.');

  const res = await mutate((db) => {
    if (db.users.some((u) => u.email === email)) return null;
    const now = new Date().toISOString();
    const u: User = { id: 'u_' + shortId(12), name, email, passwordHash: hashPassword(password), createdAt: now, lastLoginAt: now };
    db.users.push(u);
    return u;
  });
  if (!res) {
    loginFailed(ip);
    return err('email', 'يوجد حساب بهذا البريد الإلكتروني. سجّل الدخول بدلًا من ذلك.', 'This email already has an account — sign in instead.', 409);
  }
  await createUserSession(res.id);
  return Response.json({ user: publicUser(res) });
}
