import { readJson, TOO_BIG, tooBig } from '@/lib/body';
import { LIMITS } from '@/lib/limits';
import { endUserSession } from '@/lib/customer';

/** Real logout: revokes this browser's session on the server. Body `{ "all": true }` signs out every device. */
export async function POST(req: Request) {
  const raw = await readJson(req, LIMITS.small);
  if (raw === TOO_BIG) return tooBig();
  await endUserSession((raw as { all?: unknown } | null)?.all === true);
  return Response.json({ ok: true });
}
