import { isAdmin, unauthorized } from '@/lib/auth';
import { sendToOwner } from '@/lib/push';

export async function POST() {
  if (!(await isAdmin())) return unauthorized();
  const r = await sendToOwner({ title: '🎂 Petalya — تجربة إشعار', body: 'الإشعارات شغالة! هتوصلك كده كل ما يجي طلب جديد.', url: '/admin/orders', tag: 'test' });
  return Response.json(r);
}
