import { clearUserSession } from '@/lib/customer';

export async function POST() {
  await clearUserSession();
  return Response.json({ ok: true });
}
