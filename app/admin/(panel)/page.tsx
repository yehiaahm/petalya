import { readDB, readEvents } from '@/lib/db';
import { computeStats } from '@/lib/stats';
import { Overview } from '@/components/admin/Overview';

export const metadata = { title: 'نظرة عامة' };

export default async function AdminHome() {
  const [db, events] = await Promise.all([readDB(), readEvents(Date.now() - 180 * 864e5)]);
  const s = computeStats(db, events, 30);
  const recent = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 7);
  return <Overview s={s} recent={recent} hasDemo={db.orders.some((o) => o.demo)} empty={db.orders.filter((o) => !o.demo).length < 3} />;
}
