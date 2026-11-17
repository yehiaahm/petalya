import 'server-only';
import { cookies } from 'next/headers';
import { mutate, readDB } from './db';
import { safeEqual, sign } from './crypto';
import { credVersion } from './auth';
import { addSession, hasSession, newSessionId, removeSession } from './sessions';
import { siteUrl } from './site';
import type { PublicUser, User } from './types';

export const USER_COOKIE = 'petalya_user';
const MAX_AGE = 60 * 60 * 24 * 60;

async function secret() {
  return 'customer:' + (process.env.SESSION_SECRET || (await readDB()).admin.secret);
}

/** Tied to the current password, so changing or resetting it signs the old sessions out. */
const userVersion = (u: User | undefined) => credVersion(u?.passwordHash ?? 'no-password');

/**
 * A new customer session: its random id is stored on the user record (so it can be revoked) and put in the signed
 * cookie. Tokens from before this change carry no id and are rejected, so customers sign in once after deploy.
 */
export async function createUserSession(userId: string) {
  const sid = newSessionId();
  const passwordHash = await mutate((db) => {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return undefined;
    u.sessions = addSession(u.sessions, sid, Date.now(), MAX_AGE * 1000);
    return u.passwordHash ?? '';
  });
  if (passwordHash === undefined) return; // account vanished: nothing to sign in to
  const payload = Buffer.from(JSON.stringify({ uid: userId, sid, exp: Date.now() + MAX_AGE * 1000, v: credVersion(passwordHash || 'no-password') })).toString('base64url');
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

/** The cookie's claims if its signature is ours (says nothing about whether the session is still live). */
async function signedUserClaims(): Promise<{ uid: string; sid: string; exp: number; v: string } | null> {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload, await secret()))) return null;
  try {
    const { uid, sid, exp, v } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof uid !== 'string' || typeof sid !== 'string' || typeof v !== 'string' || typeof exp !== 'number') return null;
    return { uid, sid, exp, v };
  } catch {
    return null;
  }
}

async function sessionUser(): Promise<User | null> {
  const c = await signedUserClaims();
  if (!c || !(c.exp > Date.now())) return null;
  const u = (await readDB()).users.find((x) => x.id === c.uid);
  return u && hasSession(u.sessions, c.sid, Date.now()) && safeEqual(c.v, userVersion(u)) ? u : null;
}

/**
 * Real logout. Revokes this browser's session on the server (not just the cookie). With `all`, revokes every session
 * of the account, but only for a caller whose own session is valid.
 */
export async function endUserSession(all = false) {
  const c = await signedUserClaims();
  if (c) {
    const live = all ? (await sessionUser())?.id === c.uid : true;
    if (live) {
      await mutate((db) => {
        const u = db.users.find((x) => x.id === c.uid);
        if (u) u.sessions = all ? [] : removeSession(u.sessions, c.sid);
      });
    }
  }
  await clearUserSession();
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

/** Only allow same-site relative redirects (see lib/safe-next.ts). */
export { safeNext } from './safe-next';

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function appOrigin(req: Request) {
  if (process.env.APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN) return siteUrl();
  const u = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') || u.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || u.host;
  return `${proto}://${host}`;
}
