import 'server-only';
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { readDB } from './db';
import { safeEqual, sign } from './crypto';

export const SESSION_COOKIE = 'petalya_admin';

/** The admin login name: ADMIN_USERNAME when set (Railway → Variables), otherwise "admin". Compared case-insensitively. */
export function adminUsername() {
  return (process.env.ADMIN_USERNAME?.trim() || 'admin').slice(0, 60);
}
const MAX_AGE = 60 * 60 * 24 * 14;

async function secret() {
  return process.env.SESSION_SECRET || (await readDB()).admin.secret;
}

/** Changes whenever the password changes, so changing it signs every old session out. */
export const credVersion = (hash: string) => createHash('sha256').update(hash).digest('base64url').slice(0, 16);

export async function createSessionCookie() {
  const db = await readDB();
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000, v: credVersion(db.admin.passwordHash) })).toString('base64url');
  const token = `${payload}.${sign(payload, await secret())}`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function isAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  if (!safeEqual(sig, sign(payload, await secret()))) return false;
  try {
    const { exp, v } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof exp !== 'number' || exp <= Date.now() || typeof v !== 'string') return false;
    return safeEqual(v, credVersion((await readDB()).admin.passwordHash));
  } catch {
    return false;
  }
}

export function unauthorized() {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

/* Very small in-memory brute-force guard for the login routes. */
const fails = new Map<string, { n: number; until: number }>();
export function loginBlocked(key: string) {
  const f = fails.get(key);
  return !!f && f.until > Date.now();
}
export function loginFailed(key: string) {
  const f = fails.get(key) ?? { n: 0, until: 0 };
  f.n++;
  if (f.n >= 5) {
    f.until = Date.now() + 60_000 * Math.min(15, f.n - 4);
  }
  fails.set(key, f);
  if (fails.size > 5000) for (const [k, v] of fails) if (v.until < Date.now() && v.n < 5) fails.delete(k);
}
export function loginOk(key: string) {
  fails.delete(key);
}
