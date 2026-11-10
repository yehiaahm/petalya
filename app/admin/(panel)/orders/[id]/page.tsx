import { notFound } from 'next/navigation';
import { readDB } from '@/lib/db';
import { OrderDetail } from '@/components/admin/OrderDetail';

export const metadata = { title: 'تفاصيل الطلب' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDB();
  const o = db.orders.find((x) => x.id === id);
  if (!o) notFound();
  return <OrderDetail key={o.id + o.updatedAt} order={o} pay={{ instapay: db.settings.payments.instapay.handle, wallet: db.settings.payments.wallet.number }} />;
}
