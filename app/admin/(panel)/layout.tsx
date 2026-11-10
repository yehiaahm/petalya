import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { readDB } from '@/lib/db';
import { AdminShell } from '@/components/admin/AdminShell';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = await readDB();
  const latest = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const initial = {
    newOrders: db.orders.filter((o) => !o.seen && o.status !== 'cancelled').length,
    pendingReviews: db.reviews.filter((r) => r.status === 'pending').length,
    latest: latest ? { id: latest.id, code: latest.code, name: latest.customer.name, total: latest.total, createdAt: latest.createdAt } : null,
  };
  return <AdminShell initial={initial}>{children}</AdminShell>;
}
