import { proxyConfigFromEnv, resolveClientIp, UNKNOWN_IP } from './client-ip';

/** Client address + a tiny in-memory rate limiter shared by the public endpoints. */

/**
 * The key every limiter uses for "this visitor". Built only from what OUR proxy wrote (see lib/client-ip.ts):
 * x-real-ip and client-supplied x-forwarded-for entries are never believed, and an unresolvable address
 * falls into one shared "unknown" bucket instead of getting a fresh limit.
 * Configure with TRUSTED_PROXY_HOPS / TRUSTED_IP_HEADER (see .env.example).
 */
let warned = false;
export function clientIp(req: Request) {
  const ip = resolveClientIp(req.headers, proxyConfigFromEnv(process.env));
  if (ip === UNKNOWN_IP && process.env.NODE_ENV === 'production' && !warned) {
    warned = true;
    console.warn('[net] could not determine the client address from the proxy headers; requests like this share one rate-limit bucket. Check TRUSTED_PROXY_HOPS / TRUSTED_IP_HEADER.');
  }
  return ip;
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
