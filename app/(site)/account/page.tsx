import { redirect } from 'next/navigation';
import { readDB } from '@/lib/db';
import { getUser } from '@/lib/customer';
import { Account } from '@/components/site/Account';

export const metadata = { title: 'My account', robots: { index: false } };

export default async function AccountPage() {
  const user = await getUser();
  if (!user) redirect('/account/login');
  const db = await readDB();
  const orders = db.orders
    .filter((o) => o.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ id, code, createdAt, status, total, items, fulfillment }) => ({ id, code, createdAt, status, total, items, fulfillment }));
  return <Account orders={orders} />;
}
