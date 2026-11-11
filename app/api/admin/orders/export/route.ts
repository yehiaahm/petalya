import { readDB } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { PAYMENT_LABEL, STATUS_LABEL } from '@/lib/pricing';
import { csvCell } from '@/lib/safe';

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const db = await readDB();
  const esc = csvCell;
  const head = ['رقم الطلب', 'التاريخ', 'الحالة', 'العميل', 'الموبايل', 'النوع', 'المنطقة', 'العنوان', 'يوم التسليم', 'المنتجات', 'المجموع الفرعي', 'التوصيل', 'الخصم', 'الإجمالي', 'الدفع', 'حالة الدفع', 'ملاحظات'];
  const rows = [...db.orders]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((o) => [
      o.code,
      o.createdAt.slice(0, 16).replace('T', ' '),
      STATUS_LABEL[o.status].ar,
      o.customer.name,
      o.customer.phone,
      o.fulfillment.type === 'delivery' ? 'توصيل' : 'استلام',
      o.fulfillment.zoneName?.ar ?? '',
      o.fulfillment.address ?? '',
      o.fulfillment.date,
      o.items.map((i) => `${i.qty}× ${i.name.ar}`).join(' | '),
      o.subtotal,
      o.deliveryFee,
      o.discount,
      o.total,
      PAYMENT_LABEL[o.payment.method].ar,
      o.payment.status === 'paid' ? 'مدفوع' : 'غير مدفوع',
      o.notes ?? '',
    ]);
  const csv = '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="petalya-orders-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
