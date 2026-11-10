import { readDB, readEvents } from '@/lib/db';
import { computeStats } from '@/lib/stats';
import { Analytics } from '@/components/admin/Analytics';

export const metadata = { title: 'التحليلات' };

export default async function Page() {
  const [db, events] = await Promise.all([readDB(), readEvents(Date.now() - 180 * 864e5)]);
  const names = Object.fromEntries(db.products.map((p) => [p.id, p.name.ar]));
  return <Analytics s={computeStats(db, events, 30)} names={names} />;
}
