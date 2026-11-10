import { notFound } from 'next/navigation';
import { readDB } from '@/lib/db';
import { publicOrder } from '@/lib/orders';
import { OrderView } from '@/components/site/OrderView';

export const metadata = { title: 'Your order', robots: { index: false } };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = await readDB();
  const o = db.orders.find((x) => x.id === id);
  if (!o) notFound();
  return <OrderView initial={publicOrder(o)} isNew={sp.new === '1'} />;
}
