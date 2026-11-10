import { appendEvents } from '@/lib/db';
import type { TrackEvent } from '@/lib/types';
import { clientIp, rateLimited } from '@/lib/net';

const TYPES = new Set(['page_view', 'add_to_cart', 'checkout_start', 'whatsapp_click', 'builder_complete', 'link_click']);

export async function POST(req: Request) {
  if (rateLimited('track', clientIp(req), 120, 60_000)) return new Response(null, { status: 204 });
  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 204 });
  }
  const now = Date.now();
  const list = (Array.isArray(body) ? body : [body]).slice(0, 25) as Partial<TrackEvent>[];
  const clean: TrackEvent[] = [];
  for (const e of list) {
    if (!e || typeof e.type !== 'string' || !TYPES.has(e.type)) continue;
    let ref = '';
    try {
      const host = e.ref ? new URL(e.ref).hostname : '';
      ref = host && host !== new URL(req.url).hostname ? host.replace(/^www\./, '').replace(/^(l\.|lm\.|m\.)/, '') : '';
    } catch {}
    const meta: Record<string, string | number> = {};
    if (e.meta && typeof e.meta === 'object') for (const [k, v] of Object.entries(e.meta).slice(0, 6)) if (typeof v === 'string' || typeof v === 'number') meta[k.slice(0, 20)] = typeof v === 'string' ? v.slice(0, 60) : v;
    clean.push({
      t: now,
      type: e.type,
      sid: typeof e.sid === 'string' ? e.sid.slice(0, 16) : undefined,
      path: typeof e.path === 'string' ? e.path.slice(0, 80) : undefined,
      ref: ref || undefined,
      device: e.device === 'mobile' || e.device === 'tablet' || e.device === 'desktop' ? e.device : undefined,
      meta: Object.keys(meta).length ? meta : undefined,
    });
  }
  if (clean.length) await appendEvents(clean);
  return new Response(null, { status: 204 });
}
