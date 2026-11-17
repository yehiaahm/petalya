import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readDB, UPLOAD_DIR } from './db';
import { isRefUpload, planUploadSweep, refUsage, retentionFromEnv, type UploadFile } from './retention';

/**
 * Customer reference photos (/api/upload) are public and anonymous, so they are bounded (PT-06):
 *  - sweepUploads() deletes photos nobody used (no order references them) once they are old enough;
 *  - the upload route refuses a new photo when the quota is full (after trying a sweep first).
 * Admin uploads (products, gallery) are never touched here.
 */

type G = { __petalyaSweep?: { last: number; running: Promise<unknown> | null } };
const g = globalThis as G;

async function listRefUploads(): Promise<UploadFile[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(UPLOAD_DIR);
  } catch {
    return [];
  }
  const out: UploadFile[] = [];
  for (const name of names) {
    if (!isRefUpload(name)) continue;
    try {
      const st = await fs.stat(path.join(UPLOAD_DIR, name));
      if (st.isFile()) out.push({ name, size: st.size, mtimeMs: st.mtimeMs });
    } catch {}
  }
  return out;
}

/** Bytes currently held by customer reference photos. */
export async function refUploadBytes() {
  return refUsage(await listRefUploads());
}

async function referencedNames() {
  const db = await readDB();
  const used = new Set<string>();
  for (const o of db.orders) for (const u of o.refImages ?? []) used.add(u.split('/').pop() ?? '');
  return used;
}

/** Deletes customer photos older than `minAgeMs` that no order uses. Returns how many files and bytes were freed. */
export async function sweepUploads(minAgeMs = retentionFromEnv(process.env).refMaxAgeMs) {
  const files = await listRefUploads();
  const doomed = planUploadSweep(files, await referencedNames(), Date.now(), minAgeMs);
  let freed = 0;
  let deleted = 0;
  const size = new Map(files.map((f) => [f.name, f.size]));
  for (const name of doomed) {
    try {
      await fs.unlink(path.join(UPLOAD_DIR, name));
      deleted++;
      freed += size.get(name) ?? 0;
    } catch {}
  }
  return { deleted, freed };
}

/**
 * Lazy clean-up: runs at most once per MAINTENANCE_INTERVAL_SECONDS, triggered by an upload (the only thing that
 * can create orphans), so no timer is needed. Never throws.
 */
export function maybeSweepUploads() {
  const s = (g.__petalyaSweep ??= { last: 0, running: null });
  const cfg = retentionFromEnv(process.env);
  if (s.running || Date.now() - s.last < cfg.maintenanceIntervalMs) return;
  s.last = Date.now();
  s.running = sweepUploads()
    .catch((e) => console.error('[uploads] sweep failed', e instanceof Error ? e.message : e))
    .finally(() => (s.running = null));
}
