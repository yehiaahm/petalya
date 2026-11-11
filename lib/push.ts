import 'server-only';
import webpush from 'web-push';
import { mutate, readDB } from './db';
import { siteUrl } from './site';
import { shortId } from './crypto';
import type { Order, PushSub } from './types';
import { arCount } from './ar';

/**
 * Web Push for the owner's phone. VAPID keys come from the environment when set
 * (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY), otherwise a pair is generated once and kept in the database,
 * so nothing has to be configured by hand.
 */
async function vapid() {
  const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPub && envPriv) return { publicKey: envPub, privateKey: envPriv };
  const existing = (await readDB()).push.vapid;
  if (existing) return existing;
  return mutate((db) => (db.push.vapid ??= webpush.generateVAPIDKeys()));
}

function subject() {
  const s = process.env.VAPID_SUBJECT?.trim();
  if (s) return s;
  const url = siteUrl();
  // Push services want a contact URL; an https address is enough, and a localhost one is fine for testing.
  return url.startsWith('https://') ? url : 'https://petalya.invalid';
}

export async function publicVapidKey() {
  return (await vapid()).publicKey;
}

export async function listSubs(): Promise<PushSub[]> {
  return (await readDB()).push.subs;
}

export async function saveSub(input: { endpoint: unknown; keys?: { p256dh?: unknown; auth?: unknown } }, ua = '') {
  const endpoint = typeof input.endpoint === 'string' ? input.endpoint : '';
  const p256dh = typeof input.keys?.p256dh === 'string' ? input.keys.p256dh : '';
  const auth = typeof input.keys?.auth === 'string' ? input.keys.auth : '';
  let ok = false;
  try {
    ok = new URL(endpoint).protocol === 'https:' && endpoint.length < 1000 && p256dh.length > 20 && p256dh.length < 200 && auth.length > 8 && auth.length < 100;
  } catch {}
  if (!ok) return false;
  await mutate((db) => {
    const found = db.push.subs.find((s) => s.endpoint === endpoint);
    if (found) Object.assign(found, { p256dh, auth, ua: ua.slice(0, 200) });
    else db.push.subs.push({ id: shortId(10), endpoint, p256dh, auth, ua: ua.slice(0, 200), createdAt: new Date().toISOString() });
    // Keep it small: a shop owner has a couple of devices, not dozens.
    if (db.push.subs.length > 20) db.push.subs.splice(0, db.push.subs.length - 20);
  });
  return true;
}

export async function removeSub(endpoint: string) {
  await mutate((db) => {
    db.push.subs = db.push.subs.filter((s) => s.endpoint !== endpoint);
  });
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Sends to every subscribed device; devices the push service reports as gone are dropped. Never throws. */
export async function sendToOwner(payload: PushPayload) {
  try {
    const subs = await listSubs();
    if (!subs.length) return { sent: 0, failed: 0 };
    const keys = await vapid();
    const options = { vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 60 * 60 * 24, urgency: 'high' as const };
    const body = JSON.stringify(payload);
    const dead: string[] = [];
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, options);
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) dead.push(s.endpoint);
          else console.error('push failed', code ?? (e instanceof Error ? e.message : e));
        }
      }),
    );
    if (dead.length) await mutate((db) => void (db.push.subs = db.push.subs.filter((s) => !dead.includes(s.endpoint))));
    return { sent, failed: subs.length - sent };
  } catch (e) {
    console.error('push error', e instanceof Error ? e.message : e);
    return { sent: 0, failed: 0 };
  }
}

const egp = (n: number) => `${Math.round(n).toLocaleString('en-US')} ج.م`;

export function notifyNewOrder(o: Order) {
  const count = o.items.reduce((a, i) => a + i.qty, 0);
  const how = o.fulfillment.type === 'delivery' ? 'توصيل' : 'استلام';
  return sendToOwner({
    title: `🎂 طلب جديد ${o.code}`,
    body: `${o.customer.name} · ${egp(o.total)} · ${arCount(count, 'product')} · ${how} ${o.fulfillment.date}`,
    url: `/admin/orders/${o.id}`,
    tag: `order-${o.id}`,
  });
}
