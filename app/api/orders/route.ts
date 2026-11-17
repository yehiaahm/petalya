import { readJson, TOO_BIG, tooBig } from '@/lib/body';
import { LIMITS } from '@/lib/limits';
import { mutate, appendEvents } from '@/lib/db';
import { buildOrder, OrderError, type OrderInput } from '@/lib/orders';
import { getUser } from '@/lib/customer';
import { clientIp, rateLimited, tooMany } from '@/lib/net';
import { notifyNewOrder } from '@/lib/push';

export async function POST(req: Request) {
  if (rateLimited('orders', clientIp(req), 12, 60 * 60_000)) return tooMany();
  const raw = await readJson(req, LIMITS.json);
  if (raw === TOO_BIG) return tooBig();
  if (raw === null || typeof raw !== 'object') return Response.json({ error: 'bad_request' }, { status: 400 });
  const body = raw as OrderInput;
  const me = await getUser();
  try {
    const order = await mutate((db) => {
      const o = buildOrder(db, body);
      const u = me && db.users.find((x) => x.id === me.id);
      if (u) {
        o.userId = u.id;
        // Remember delivery details on the account for next time.
        u.phone ||= o.customer.phone;
        if (o.fulfillment.type === 'delivery') {
          u.zoneId ||= o.fulfillment.zoneId;
          u.address ||= o.fulfillment.address;
        }
      }
      db.orders.push(o);
      return o;
    });
    await appendEvents([{ t: Date.now(), type: 'order_placed', meta: { total: order.total, code: order.code } }]);
    // Ping the owner's phone; never let a push problem fail the customer's order.
    void notifyNewOrder(order);
    return Response.json({ id: order.id, code: order.code });
  } catch (e) {
    if (e instanceof OrderError) return Response.json({ error: e.field, message: e.msg }, { status: 422 });
    console.error(e);
    return Response.json({ error: 'server' }, { status: 500 });
  }
}
