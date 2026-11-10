import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, readDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Railway health check: the data volume is writable and the database opens (this also fails fast on missing secrets). */
export async function GET() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const probe = path.join(DATA_DIR, '.health');
    await fs.writeFile(probe, String(Date.now()));
    await fs.unlink(probe);
    await readDB();
    return Response.json({ ok: true });
  } catch (e) {
    console.error('health check failed:', e instanceof Error ? e.message : e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
