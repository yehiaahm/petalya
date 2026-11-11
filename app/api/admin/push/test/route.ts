import { isAdmin, unauthorized } from '@/lib/auth';
import { sendToOwner } from '@/lib/push';

export async function POST() {
  if (!(await isAdmin())) return unauthorized();
  const r = await sendToOwner({ title: '🎂 Petalya — إشعار تجريبي', body: 'الإشعارات تعمل! سيصلك إشعار مثل هذا مع كل طلب جديد.', url: '/admin/orders', tag: 'test' });
  return Response.json(r);
}
