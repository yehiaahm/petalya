/** Client address + a tiny in-memory rate limiter shared by the public endpoints. */

/**
 * Behind Railway's edge, `x-real-ip` is the client address. Fall back to the LAST
 * `x-forwarded-for` entry (the one appended by the nearest proxy) — never the first,
 * which a visitor can set to anything.
 */
export function clientIp(req: Request) {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 64);
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1].slice(0, 64);
  }
  return 'local';
}

type Bucket = Map<string, number[]>;
type G = { __petalyaRate?: Map<string, Bucket> };
const buckets = ((globalThis as G).__petalyaRate ??= new Map<string, Bucket>());

/**
 * Sliding-window limiter. Returns true when `key` has already used `max` hits in the last `windowMs`
 * (and does not record the blocked attempt).
 */
export function rateLimited(scope: string, key: string, max: number, windowMs: number) {
  let b = buckets.get(scope);
  if (!b) buckets.set(scope, (b = new Map()));
  const now = Date.now();
  const recent = (b.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    b.set(key, recent);
    return true;
  }
  recent.push(now);
  b.set(key, recent);
  if (b.size > 5000) for (const [k, v] of b) if (!v.some((t) => now - t < windowMs)) b.delete(k);
  return false;
}

export const tooMany = (extra: Record<string, unknown> = {}) => Response.json({ error: 'rate', ...extra }, { status: 429, headers: { 'retry-after': '60' } });

/** Passwords are hashed with scrypt, so cap their length to keep a huge value from burning CPU. */
export const MAX_PASSWORD = 200;
