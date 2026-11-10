import { readDB } from '@/lib/db';
import { Customers, type CustomerRow } from '@/components/admin/ContentEditors';

export const metadata = { title: 'العملاء' };

export default async function Page() {
  const db = await readDB();
  const m = new Map<string, CustomerRow>();
  const byUser = new Map(db.users.map((u) => [u.id, u]));
  [...db.orders]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((o) => {
      const u = o.userId ? byUser.get(o.userId) : undefined;
      // Group account orders under the account; guest orders by phone.
      const key = u ? 'u:' + u.id : 'p:' + o.customer.phone;
      const r = m.get(key) ?? { key, phone: o.customer.phone, name: o.customer.name, orders: 0, spent: 0, last: o.createdAt, first: o.createdAt };
      r.name = u?.name || o.customer.name;
      r.last = o.createdAt;
      if (o.status !== 'cancelled') {
        r.orders += 1;
        r.spent += o.total;
      }
      if (o.fulfillment.zoneName) r.zone = o.fulfillment.zoneName.ar;
      m.set(key, r);
    });
  db.users.forEach((u) => {
    const key = 'u:' + u.id;
    const r = m.get(key) ?? { key, phone: u.phone || '', name: u.name, orders: 0, spent: 0, last: u.createdAt, first: u.createdAt };
    Object.assign(r, { account: { id: u.id, email: u.email, google: !!u.googleId, hasPassword: !!u.passwordHash, avatar: u.avatar, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt } });
    if (!r.phone && u.phone) r.phone = u.phone;
    m.set(key, r);
  });
  return <Customers rows={[...m.values()]} />;
}
