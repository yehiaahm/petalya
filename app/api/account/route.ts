import { mutate } from '@/lib/db';
import { getUser, publicUser } from '@/lib/customer';
import { normalisePhone } from '@/lib/orders';

export async function PATCH(req: Request) {
  const me = await getUser();
  if (!me) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { name?: string; phone?: string; zoneId?: string; address?: string };
  const phone = b.phone !== undefined ? normalisePhone(String(b.phone)) : undefined;
  if (phone && !/^01[0125]\d{8}$/.test(phone)) return Response.json({ error: 'phone', message: { ar: 'أدخل رقم موبايل من ١١ رقمًا يبدأ بـ 01.', en: 'Enter an 11-digit mobile starting with 01.' } }, { status: 422 });
  const u = await mutate((db) => {
    const u = db.users.find((x) => x.id === me.id)!;
    if (typeof b.name === 'string' && b.name.trim().length >= 2) u.name = b.name.trim().slice(0, 80);
    if (phone !== undefined) u.phone = phone || undefined;
    if (typeof b.zoneId === 'string') u.zoneId = db.settings.zones.some((z) => z.id === b.zoneId) ? b.zoneId : undefined;
    if (typeof b.address === 'string') u.address = b.address.trim().slice(0, 300) || undefined;
    return u;
  });
  return Response.json({ user: publicUser(u) });
}
