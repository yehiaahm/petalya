import 'server-only';
import { cookies } from 'next/headers';
import { readDB } from './db';
import { safeEqual, sign } from './crypto';
import { credVersion } from './auth';
import { siteUrl } from './site';
import type { PublicUser, User } from './types';

export const USER_COOKIE = 'petalya_user';
const MAX_AGE = 60 * 60 * 24 * 60;

async function secret() {
  return 'customer:' + (process.env.SESSION_SECRET || (await readDB()).admin.secret);
}

/** Tied to the current password, so changing or resetting it signs the old sessions out. */
const userVersion = (u: User | undefined) => credVersion(u?.passwordHash ?? 'no-password');

export async function createUserSession(userId: string) {
  const user = (await readDB()).users.find((x) => x.id === userId);
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000, v: userVersion(user) })).toString('base64url');
  (await cookies()).set(USER_COOKIE, `${payload}.${sign(payload, await secret())}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearUserSession() {
  (await cookies()).delete(USER_COOKIE);
}

async function sessionUser(): Promise<User | null> {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload, await secret()))) return null;
  try {
    const { uid, exp, v } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof uid !== 'string' || typeof v !== 'string' || !(exp > Date.now())) return null;
    const u = (await readDB()).users.find((x) => x.id === uid);
    return u && safeEqual(v, userVersion(u)) ? u : null;
  } catch {
    return null;
  }
}

export async function getUser(): Promise<User | null> {
  return sessionUser();
}

export function publicUser(u: User | null): PublicUser | null {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? '',
    avatar: u.avatar ?? '',
    zoneId: u.zoneId ?? '',
    address: u.address ?? '',
    google: !!u.googleId,
    hasPassword: !!u.passwordHash,
  };
}

export const normEmail = (e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase().slice(0, 120) : '');
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/** Only allow same-site relative redirects. */
export function safeNext(n: unknown, fallback = '/account') {
  const s = typeof n === 'string' ? n : '';
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/\\') ? s.slice(0, 200) : fallback;
}

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function appOrigin(req: Request) {
  if (process.env.APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN) return siteUrl();
  const u = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') || u.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || u.host;
  return `${proto}://${host}`;
}
