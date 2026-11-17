/**
 * Trusted-proxy client address resolution.
 *
 * Why this exists: every rate limit and login lockout is keyed on "the client's IP". If that value
 * is read from a header the visitor can set (x-real-ip, or the first x-forwarded-for entry), an
 * attacker simply sends a different value on every request and no limit ever triggers.
 *
 * Rules implemented here:
 *  1. Only the part of the proxy chain that OUR OWN proxies wrote is trusted. Each trusted proxy
 *     appends the address it received the request from to `x-forwarded-for`, so with N trusted
 *     proxies the real client is the N-th entry counted from the RIGHT. Anything to the left of that
 *     was supplied by the client (or by an untrusted hop) and is ignored.
 *  2. `x-real-ip` and every other single-value header is ignored unless the operator explicitly names
 *     it in TRUSTED_IP_HEADER, which they should only do after verifying that their proxy overwrites it.
 *  3. If the address cannot be determined (no proxy header, chain shorter than expected, junk value)
 *     the request is put in one shared "unknown" bucket. Failing closed means a missing or forged
 *     header can never buy a fresh limit.
 *  4. IPv6 clients are keyed by their /64, because one subscriber normally controls a whole /64 and
 *     could otherwise rotate through 2^64 addresses.
 *
 * Pure functions, no imports: unit-tested directly (tests/unit/client-ip.test.mjs).
 */

export const UNKNOWN_IP = 'unknown';

export type ProxyConfig = {
  /** How many reverse proxies we run/trust in front of the app (0 = trust no forwarding header at all). */
  hops: number;
  /** Optional single header the operator has verified is overwritten by the proxy (e.g. "x-real-ip"). */
  header: string | null;
};

type HeaderSource = { get(name: string): string | null };

/**
 * TRUSTED_PROXY_HOPS   integer 0-9. Default: 1 in production (Railway terminates TLS in front of the app),
 *                      0 otherwise (local development has no proxy, so no header is believed).
 *                      Use 2 if you also put Cloudflare (or another CDN) in front of Railway.
 * TRUSTED_IP_HEADER    optional header name to use INSTEAD of x-forwarded-for. Only set after verifying
 *                      that the proxy overwrites it.
 */
export function proxyConfigFromEnv(env: Record<string, string | undefined>): ProxyConfig {
  const raw = env.TRUSTED_PROXY_HOPS?.trim();
  const fallback = env.NODE_ENV === 'production' ? 1 : 0;
  const hops = raw && /^\d$/.test(raw) ? Number(raw) : fallback;
  const h = env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  const header = h && /^[a-z0-9-]{1,40}$/.test(h) && h !== 'x-forwarded-for' ? h : null;
  return { hops, header };
}

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`);

/** Parses an IPv6 literal into 8 16-bit groups, or null. Accepts "::" compression and a trailing dotted IPv4. */
function parseIPv6(input: string): number[] | null {
  let s = input;
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  if (!s.includes(':') || !/^[0-9a-fA-F:.]+$/.test(s)) return null;

  const lastColon = s.lastIndexOf(':');
  const tail = s.slice(lastColon + 1);
  if (tail.includes('.')) {
    if (!IPV4.test(tail)) return null;
    const o = tail.split('.').map(Number);
    s = s.slice(0, lastColon + 1) + ((o[0] << 8) | o[1]).toString(16) + ':' + ((o[2] << 8) | o[3]).toString(16);
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part === '' ? [] : part.split(':'));
  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  const all = [...head, ...rest];
  if (all.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return null;
  if (halves.length === 1 ? head.length !== 8 : head.length + rest.length > 7) return null;
  const zeros = halves.length === 2 ? new Array(8 - head.length - rest.length).fill('0') : [];
  return [...head, ...zeros, ...rest].map((g) => parseInt(g, 16));
}

/** One canonical rate-limit key for an address, or null when it is not a valid IP. */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s || s.length > 64) return null;
  if (s.startsWith('[')) {
    const end = s.indexOf(']');
    if (end < 0) return null;
    s = s.slice(1, end);
  } else if (/^[^:]+:\d{1,5}$/.test(s)) {
    s = s.slice(0, s.lastIndexOf(':')); // "1.2.3.4:51234"
  }
  if (IPV4.test(s)) return s.split('.').map(Number).join('.');
  const g = parseIPv6(s);
  if (!g) return null;
  // ::ffff:a.b.c.d is just an IPv4 client reaching a dual-stack socket.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join('.');
  return g.slice(0, 4).map((x) => x.toString(16)).join(':') + '::/64';
}

/** The key to rate-limit this request under. Never throws and never returns a value the client picked freely. */
export function resolveClientIp(headers: HeaderSource, cfg: ProxyConfig): string {
  if (cfg.header) return normalizeIp(headers.get(cfg.header)) ?? UNKNOWN_IP;
  if (cfg.hops < 1) return UNKNOWN_IP;
  const xff = headers.get('x-forwarded-for');
  if (!xff) return UNKNOWN_IP;
  // Positions matter: do not drop empty entries, or a client could shift which entry we pick.
  const parts = xff.split(',').map((p) => p.trim());
  if (parts.length < cfg.hops) return UNKNOWN_IP;
  return normalizeIp(parts[parts.length - cfg.hops]) ?? UNKNOWN_IP;
}
