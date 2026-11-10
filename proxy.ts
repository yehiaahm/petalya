import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs in front of every /api request:
 *  - blocks cross-site state-changing requests (CSRF defence in depth, on top of SameSite cookies)
 *  - rejects oversized bodies before they are read
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MB = 1024 * 1024;

function limitFor(pathname: string) {
  if (pathname === '/api/admin/upload') return 12 * MB;
  if (pathname === '/api/upload') return 6 * MB;
  return 2 * MB;
}

function hostOf(value: string | null) {
  if (!value) return '';
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return '';
  }
}

export function proxy(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) return NextResponse.next();

  const deny = (status: number, error: string) => NextResponse.json({ error }, { status });

  if (req.headers.get('sec-fetch-site') === 'cross-site') return deny(403, 'forbidden');

  const origin = hostOf(req.headers.get('origin'));
  if (origin) {
    const allowed = new Set<string>();
    for (const h of [req.headers.get('host'), req.headers.get('x-forwarded-host')]) {
      if (h) allowed.add(h.split(',')[0].trim().toLowerCase());
    }
    const site = hostOf(process.env.APP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : null));
    if (site) allowed.add(site);
    if (!allowed.has(origin)) return deny(403, 'forbidden');
  }

  const length = Number(req.headers.get('content-length') || 0);
  if (length > limitFor(req.nextUrl.pathname)) return deny(413, 'too_big');

  return NextResponse.next();
}

export const config = { matcher: '/api/:path*' };
