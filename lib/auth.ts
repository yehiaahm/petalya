import 'server-only';
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { mutate, readDB } from './db';
import { safeEqual, sign } from './crypto';
import { addSession, hasSession, newSessionId, removeSession } from './sessions';
import { createFailureCeiling, type FailureCeiling } from './admin-throttle';
import { sendToOwner } from './push';

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

/**
 * A new admin session: its random id is stored in the database (so it can be revoked) and put in the signed
 * cookie. Tokens from before this change carry no id and are rejected, so everyone signs in once after deploy.
 */
export async function createSessionCookie() {
  const sid = newSessionId();
  const hash = await mutate((db) => {
    db.admin.sessions = addSession(db.admin.sessions, sid, Date.now(), MAX_AGE * 1000);
    return db.admin.passwordHash;
  });
  const payload = Buffer.from(JSON.stringify({ sid, exp: Date.now() + MAX_AGE * 1000, v: credVersion(hash) })).toString('base64url');
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

/** The cookie's claims if its signature is ours (says nothing about whether the session is still live). */
async function signedAdminClaims(): Promise<{ sid: string; exp: number; v: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if (!safeEqual(sig, sign(payload, await secret()))) return null;
  try {
    const { sid, exp, v } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof sid !== 'string' || typeof exp !== 'number' || typeof v !== 'string') return null;
    return { sid, exp, v };
  } catch {
    return null;
  }
}

export async function isAdmin() {
  const c = await signedAdminClaims();
  if (!c || c.exp <= Date.now()) return false;
  const db = await readDB();
  return hasSession(db.admin.sessions, c.sid, Date.now()) && safeEqual(c.v, credVersion(db.admin.passwordHash));
}

/**
 * Real logout. Revokes this browser's session on the server (not just the cookie). With `all`, revokes every
 * admin session, but only for a caller whose own session is valid, so an anonymous request can never sign the
 * owner out.
 */
export async function endAdminSession(all = false) {
  if (all) {
    if (await isAdmin()) await mutate((db) => void (db.admin.sessions = []));
  } else {
    const c = await signedAdminClaims();
    if (c) await mutate((db) => void (db.admin.sessions = removeSession(db.admin.sessions, c.sid)));
  }
  await clearSessionCookie();
}

/**
 * For admin PAGES. Layout and page render in parallel, so a check in the layout does not stop a page's
 * data fetch (the data would still be streamed inside the redirect response). Admin pages must read data
 * through lib/admin-data.ts, which calls this first.
 */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/login');
}

export function unauthorized() {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}

/* ---------- admin sign-in throttle (PT-03) ---------- */

/**
 * "Trusted device": a signed cookie set when the owner signs in correctly. It lets the owner's own browser
 * through the global failure ceiling below, so strangers failing to guess the password cannot keep the owner
 * out. It grants no access by itself (the password is still required) and it does NOT bypass the per-client
 * lockout. Tied to the current password, so changing the password revokes every trusted device.
 */
export const DEVICE_COOKIE = 'petalya_admin_device';
const DEVICE_MAX_AGE = 60 * 60 * 24 * 90;

async function deviceKey() {
  return 'admin-device:' + (await secret());
}

export async function rememberAdminDevice() {
  const db = await readDB();
  const payload = Buffer.from(JSON.stringify({ k: 'admin-device', exp: Date.now() + DEVICE_MAX_AGE * 1000, v: credVersion(db.admin.passwordHash) })).toString('base64url');
  (await cookies()).set(DEVICE_COOKIE, `${payload}.${sign(payload, await deviceKey())}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEVICE_MAX_AGE,
  });
}

export async function isKnownAdminDevice() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  if (!safeEqual(sig, sign(payload, await deviceKey()))) return false;
  try {
    const { k, exp, v } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (k !== 'admin-device' || typeof exp !== 'number' || exp <= Date.now() || typeof v !== 'string') return false;
    return safeEqual(v, credVersion((await readDB()).admin.passwordHash));
  } catch {
    return false;
  }
}

type Ceilings = { __petalyaAdminCeiling?: FailureCeiling };
const ceiling = ((globalThis as Ceilings).__petalyaAdminCeiling ??= createFailureCeiling({ limit: 60, windowMs: 10 * 60_000 }));

/**
 * True when an admin sign-in attempt must be refused before any password work is done:
 *  - this client has already failed too often (per-client lockout, keyed on the trusted client address), or
 *  - far too many wrong passwords arrived from everywhere in the last ten minutes AND this browser is not a
 *    trusted device (the owner's own browser is never held back by other people's failures).
 */
export async function adminLoginBlocked(clientKey: string) {
  if (loginBlocked(clientKey)) return true;
  if (!ceiling.blocked()) return false;
  return !(await isKnownAdminDevice());
}

/** Record a wrong admin password. Alerts the owner's phone when the global ceiling is reached. */
export function adminLoginFailed(clientKey: string) {
  loginFailed(clientKey);
  if (ceiling.failure()) {
    void sendToOwner({ title: '⚠️ Petalya — محاولات دخول كتيرة', body: 'فيه محاولات كتير غلط لدخول لوحة التحكم. لو مش إنت، غيّر الباسورد من الإعدادات.', url: '/admin/login', tag: 'login-alert' });
  }
}

/** A correct admin sign-in: clear this client's failures and remember the browser. */
export async function adminLoginSucceeded(clientKey: string) {
  loginOk(clientKey);
  await createSessionCookie();
  await rememberAdminDevice();
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
