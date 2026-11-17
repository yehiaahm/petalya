/**
 * Request-body size ceilings (bytes). Pure constants so proxy.ts and the route handlers agree.
 *
 * The ceilings are enforced twice:
 *  - proxy.ts rejects an honest oversized `Content-Length` before any body is read (cheap early exit);
 *  - lib/net.ts readBytes()/readJson()/readForm() count the bytes AS THEY ARRIVE and stop reading at the
 *    ceiling, which is the only check that also works for chunked bodies that send no Content-Length.
 */
export const MB = 1024 * 1024;

export const LIMITS = {
  /** Credentials, lookups, coupon checks, reviews, small admin actions: a few hundred bytes in practice. */
  small: 16 * 1024,
  /** Public JSON that can carry a whole cart (orders) or a batch of analytics events. */
  json: 256 * 1024,
  /** Admin editors that save whole lists (settings, products, gallery, coupons, …). */
  adminJson: 2 * MB,
  /** Customer reference photo: the file is capped at 4 MB, this leaves room for the multipart envelope. */
  upload: 6 * MB,
  /** Admin photo upload: file capped at 10 MB. */
  adminUpload: 12 * MB,
} as const;

/** Ceiling for a given API path, used by proxy.ts for the Content-Length early exit. */
export function limitForPath(pathname: string): number {
  if (pathname === '/api/admin/upload') return LIMITS.adminUpload;
  if (pathname === '/api/upload') return LIMITS.upload;
  if (pathname === '/api/orders' || pathname === '/api/track') return LIMITS.json;
  if (pathname.startsWith('/api/admin/')) return LIMITS.adminJson;
  return LIMITS.small;
}
