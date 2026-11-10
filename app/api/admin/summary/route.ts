import { readDB } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const db = await readDB();
  const unseen = db.orders.filter((o) => !o.seen && o.status !== 'cancelled');
  const latest = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return Response.json(
    {
      newOrders: unseen.length,
      pendingReviews: db.reviews.filter((r) => r.status === 'pending').length,
      latest: latest ? { id: latest.id, code: latest.code, name: latest.customer.name, total: latest.total, createdAt: latest.createdAt } : null,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
