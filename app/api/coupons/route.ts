import { readDB } from '@/lib/db';
import { couponDiscount } from '@/lib/pricing';
import { clientIp, rateLimited, tooMany } from '@/lib/net';

export async function POST(req: Request) {
  if (rateLimited('coupons', clientIp(req), 30, 10 * 60_000)) return tooMany();
  const { code, subtotal } = (await req.json().catch(() => ({}))) as { code?: string; subtotal?: number };
  const db = await readDB();
  const c = db.coupons.find((x) => x.code.toUpperCase() === String(code || '').trim().toUpperCase());
  if (!c || !c.active) return Response.json({ ok: false, reason: 'invalid' });
  const sub = Number(subtotal) || 0;
  if (sub < c.minSubtotal) return Response.json({ ok: false, reason: 'min', min: c.minSubtotal });
  const discount = couponDiscount(c, sub);
  if (!discount) return Response.json({ ok: false, reason: 'expired' });
  return Response.json({ ok: true, code: c.code, type: c.type, value: c.value, minSubtotal: c.minSubtotal, discount });
}
