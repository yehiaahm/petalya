/**
 * Server-side session records (PT-05). Pure helpers, no imports beyond node:crypto, unit-tested directly
 * (tests/unit/sessions.test.mjs).
 *
 * A session cookie used to be a self-contained signed token: "logout" only deleted the browser's copy, and a
 * stolen copy stayed valid until it expired (14 days for the admin, 60 for customers). Now every signed-in
 * browser also has a random session id stored in the database, the cookie carries that id, and a request is
 * accepted only while the id is still on the list. Logging out removes the id; "sign out everywhere", a password
 * change and an admin password reset empty the list. Knowing a cookie is no longer enough once it is revoked.
 */
import { randomBytes } from 'node:crypto';

export type Session = { id: string; /** expiry, ms since epoch */ exp: number; /** created, ms since epoch */ at: number };

/** Most browsers/devices remembered per account; the oldest are dropped first. */
export const MAX_SESSIONS = 20;

export const newSessionId = () => randomBytes(18).toString('base64url');

/** The list with expired sessions pruned and the new one added (newest kept if over the cap). */
export function addSession(list: Session[] | undefined, id: string, now: number, ttlMs: number, cap = MAX_SESSIONS): Session[] {
  const live = (list ?? []).filter((s) => s.exp > now);
  live.push({ id, exp: now + ttlMs, at: now });
  return live.slice(-cap);
}

/** True only for a well-formed id that is on the list and not expired. */
export function hasSession(list: Session[] | undefined, id: unknown, now: number): boolean {
  if (typeof id !== 'string' || id.length < 16 || id.length > 64) return false;
  return (list ?? []).some((s) => s.id === id && s.exp > now);
}

export const removeSession = (list: Session[] | undefined, id: string): Session[] => (list ?? []).filter((s) => s.id !== id);
