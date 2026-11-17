import { Suspense } from 'react';
import { readDBAsAdmin } from '@/lib/admin-data';
import { Orders } from '@/components/admin/Orders';

export const metadata = { title: 'الطلبات' };

export default async function OrdersPage() {
  const db = await readDBAsAdmin();
  return (
    <Suspense>
      <Orders orders={db.orders} />
    </Suspense>
  );
}
