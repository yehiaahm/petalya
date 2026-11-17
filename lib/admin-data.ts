import 'server-only';
import { readDB, readEvents } from './db';
import { requireAdmin } from './auth';

/**
 * The only way admin pages should read data. The admin check runs BEFORE the file is read, so a page
 * can't leak data by forgetting it (a layout-only check is not enough: see requireAdmin in auth.ts).
 */
export async function readDBAsAdmin() {
  await requireAdmin();
  return readDB();
}

export async function readEventsAsAdmin(sinceMs = 0) {
  await requireAdmin();
  return readEvents(sinceMs);
}
