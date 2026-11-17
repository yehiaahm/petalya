/**
 * Retention and quota rules for the data folder (PT-06). Pure functions, no imports, so they are unit-tested
 * directly (tests/unit/retention.test.mjs). The file-system wiring lives in lib/uploads.ts and lib/db.ts.
 *
 * Everything an anonymous visitor can make the server write is now bounded:
 *  - customer reference photos (/api/upload): deleted after REF_UPLOAD_MAX_AGE_DAYS unless an order uses them,
 *    and refused once the folder holds REF_UPLOAD_QUOTA_MB of them;
 *  - analytics events (/api/track): older than EVENTS_RETENTION_DAYS are dropped, the file never exceeds
 *    EVENTS_MAX_MB: when it is reached the oldest events are dropped to make room (ring buffer).
 */

export type RetentionConfig = {
  /** Unreferenced customer photos older than this are deleted. */
  refMaxAgeMs: number;
  /** Total bytes of customer reference photos allowed on disk. */
  refQuotaBytes: number;
  /** Analytics events older than this are dropped (the dashboard reads at most 180 days). */
  eventsRetentionMs: number;
  /** Hard ceiling for events.jsonl. */
  eventsMaxBytes: number;
  /** How often the lazy clean-up may run. */
  maintenanceIntervalMs: number;
};

const num = (v: string | undefined, fallback: number) => {
  const n = v === undefined || v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * REF_UPLOAD_MAX_AGE_DAYS (14), REF_UPLOAD_QUOTA_MB (300), EVENTS_RETENTION_DAYS (180), EVENTS_MAX_MB (50),
 * MAINTENANCE_INTERVAL_SECONDS (3600). Invalid, zero or negative values fall back to the default.
 */
export function retentionFromEnv(env: Record<string, string | undefined>): RetentionConfig {
  return {
    refMaxAgeMs: num(env.REF_UPLOAD_MAX_AGE_DAYS, 14) * 864e5,
    refQuotaBytes: Math.round(num(env.REF_UPLOAD_QUOTA_MB, 300) * 1024 * 1024),
    eventsRetentionMs: num(env.EVENTS_RETENTION_DAYS, 180) * 864e5,
    eventsMaxBytes: Math.round(num(env.EVENTS_MAX_MB, 50) * 1024 * 1024),
    maintenanceIntervalMs: num(env.MAINTENANCE_INTERVAL_SECONDS, 3600) * 1000,
  };
}

/** Names the public upload route creates (see app/api/upload/route.ts). Admin uploads never match. */
export const REF_UPLOAD = /^ref-[a-z0-9]+-[a-z0-9]+\.(webp|jpg|png|avif)$/;
export const isRefUpload = (name: string) => REF_UPLOAD.test(name);

export type UploadFile = { name: string; size: number; mtimeMs: number };

/**
 * Which customer photos to delete: older than `minAgeMs` AND not used by any order. Admin uploads and anything
 * that is not a customer photo are never touched.
 */
export function planUploadSweep(files: UploadFile[], referenced: ReadonlySet<string>, now: number, minAgeMs: number): string[] {
  return files.filter((f) => isRefUpload(f.name) && !referenced.has(f.name) && now - f.mtimeMs >= minAgeMs).map((f) => f.name);
}

/** Total bytes held by customer photos. */
export const refUsage = (files: UploadFile[]) => files.reduce((a, f) => (isRefUpload(f.name) ? a + f.size : a), 0);

export type EventLines = { kept: string[]; dropped: number; bytes: number };

/**
 * Rewrites the events log: drops lines older than the retention window or that are not valid events, then, if the
 * result is still over 80 % of `maxBytes`, drops the oldest lines until it is. (80 % leaves headroom so the
 * log does not hit the ceiling again on the very next write.)
 */
export function compactEventLines(lines: string[], now: number, retentionMs: number, maxBytes: number): EventLines {
  const cutoff = now - retentionMs;
  const valid: { line: string; len: number }[] = [];
  let total = 0;
  for (const line of lines) {
    if (!line) continue;
    total++;
    try {
      const t = (JSON.parse(line) as { t?: unknown }).t;
      if (typeof t === 'number' && t >= cutoff) valid.push({ line, len: Buffer.byteLength(line) + 1 });
    } catch {}
  }
  let bytes = valid.reduce((a, x) => a + x.len, 0);
  const target = maxBytes * 0.8;
  let start = 0;
  while (bytes > target && start < valid.length) bytes -= valid[start++].len;
  const kept = valid.slice(start).map((x) => x.line);
  return { kept, dropped: total - kept.length, bytes };
}
