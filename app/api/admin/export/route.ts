import { readDB } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const { admin: _admin, ...rest } = await readDB();
  const safe = { ...rest, users: rest.users.map(({ passwordHash: _p, ...u }) => u) };
  return new Response(JSON.stringify(safe, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="petalya-backup-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
