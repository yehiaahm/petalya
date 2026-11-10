import { isAdmin, unauthorized } from '@/lib/auth';
import { listSubs, publicVapidKey, removeSub, saveSub } from '@/lib/push';

/** State for the "order notifications" switch in the admin: the public key and whether this device is subscribed. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const endpoint = new URL(req.url).searchParams.get('endpoint') || '';
  const [key, subs] = await Promise.all([publicVapidKey(), listSubs()]);
  return Response.json({ key, devices: subs.length, subscribed: !!endpoint && subs.some((s) => s.endpoint === endpoint) });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body || !(await saveSub(body, req.headers.get('user-agent') || ''))) return Response.json({ error: 'bad_subscription' }, { status: 400 });
  return Response.json({ ok: true, devices: (await listSubs()).length });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (typeof body?.endpoint === 'string') await removeSub(body.endpoint);
  return Response.json({ ok: true, devices: (await listSubs()).length });
}
