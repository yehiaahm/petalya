import { Suspense } from 'react';
import { readDB } from '@/lib/db';
import { Orders } from '@/components/admin/Orders';

export const metadata = { title: 'الطلبات' };

export default async function OrdersPage() {
  const db = await readDB();
  return (
    <Suspense>
      <Orders orders={db.orders} />
    </Suspense>
  );
}
