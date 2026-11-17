import { readJson, TOO_BIG, tooBig } from '@/lib/body';
import { LIMITS } from '@/lib/limits';
import { readDB } from '@/lib/db';
import { normalisePhone } from '@/lib/orders';
import { clientIp, rateLimited, tooMany } from '@/lib/net';

export async function POST(req: Request) {
  if (rateLimited('lookup', clientIp(req), 15, 10 * 60_000)) return tooMany();
  const raw = await readJson(req, LIMITS.small);
  if (raw === TOO_BIG) return tooBig();
  const { code, phone } = (raw ?? {}) as { code?: string; phone?: string };
  const c = String(code || '').trim().toUpperCase().replace(/^(PT)?-?/, 'PT-');
  const p = normalisePhone(String(phone || ''));
  const db = await readDB();
  const o = db.orders.find((x) => x.code === c && x.customer.phone === p);
  if (!o) return Response.json({ error: 'not_found' }, { status: 404 });
  return Response.json({ id: o.id });
}
