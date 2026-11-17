import 'server-only';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { DB, PublicData, TrackEvent } from './types';
import { createSeed, defaultReviewShots, defaultSettings } from './seed';
import { AR_COPY_UPDATES, EN_COPY_UPDATES } from './copy-updates';
import { compactEventLines, retentionFromEnv } from './retention';

export const DATA_DIR = process.env.PETALYA_DATA_DIR || path.join(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');

type Cached<T> = { key: string; value: T };
type G = {
  __petalyaLock?: Promise<unknown>;
  __petalyaInit?: Promise<void>;
  __petalyaEventsLock?: Promise<unknown>;
  __petalyaEventsMaint?: { last: number; warned: boolean };
  __petalyaPublic?: Cached<PublicData> | null;
  __petalyaOrderIds?: Cached<Set<string>> | null;
};
const g = globalThis as G;

async function ensure() {
  if (!g.__petalyaInit) {
    g.__petalyaInit = (async () => {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      try {
        await fs.access(DB_FILE);
      } catch {
        await writeFileAtomic(DB_FILE, JSON.stringify(createSeed(), null, 2));
      }
    })();
  }
  return g.__petalyaInit;
}

async function writeFileAtomic(file: string, data: string) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data, 'utf8');
  for (let i = 0; ; i++) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (e) {
      // Windows can briefly lock the target while it is being read.
      if (i > 8) throw e;
      await new Promise((r) => setTimeout(r, 25 * (i + 1)));
    }
  }
}

function migrate(db: DB): DB {
  // Fill in settings added after the database was created.
  const d = defaultSettings();
  db.settings = { ...d, ...db.settings, payments: { ...d.payments, ...db.settings.payments }, builder: { ...d.builder, ...db.settings.builder } };
  // The shop's real number replaces the untouched placeholder from the design handoff (never an edited value).
  if (db.settings.whatsapp === '201000000000') db.settings.whatsapp = d.whatsapp;
  db.coupons ??= [];
  db.counters ??= { order: 1000 };
  db.users ??= [];
  db.admin.sessions ??= [];
  db.push ??= { subs: [] };
  db.push.subs ??= [];
  db.reviewShots ??= defaultReviewShots();
  reviseSeedCopy(db);
  return db;
}

/** Swaps untouched seed wording for the revised Arabic copy (see copy-updates.ts). Edited text is never matched. */
function reviseSeedCopy(db: DB) {
  const fix = (l?: { ar: string; en?: string } | null, map: Map<string, string> = AR_COPY_UPDATES.text) => {
    if (!l) return;
    const next = map.get(l.ar);
    if (next) l.ar = next;
    const nextEn = l.en && EN_COPY_UPDATES.get(l.en);
    if (nextEn) l.en = nextEn;
  };
  db.categories?.forEach((c) => fix(c.name));
  db.products?.forEach((p) => (fix(p.name), fix(p.desc)));
  db.gallery?.forEach((g) => (fix(g.title), fix(g.occasion), fix(g.note)));
  db.reviews?.forEach((r) => (fix(r.quote), fix(r.occasion)));
  const s = db.settings;
  fix(s.closedMessage);
  fix(s.pickupAddress);
  s.timeSlots?.forEach((t) => fix(t.name));
  const b = s.builder;
  b.occasions?.forEach((o) => (fix(o.name), fix(o.topper)));
  b.sizes?.forEach((z) => (fix(z.name), fix(z.serves)));
  b.flavours?.forEach((f) => fix(f.name, AR_COPY_UPDATES.flavour));
  b.colours?.forEach((c) => fix(c.name, AR_COPY_UPDATES.colour));
  b.decorations?.forEach((d) => fix(d.name, AR_COPY_UPDATES.decoration));
}

export async function readDB(): Promise<DB> {
  await ensure();
  for (let i = 0; ; i++) {
    try {
      return migrate(JSON.parse(await fs.readFile(DB_FILE, 'utf8')) as DB);
    } catch (e) {
      if (i > 4) throw e;
      await new Promise((r) => setTimeout(r, 30));
    }
  }
}

/** Serialised read-modify-write. Everything written goes through here. */
export async function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const db = await readDB();
    const out = await fn(db);
    await writeFileAtomic(DB_FILE, JSON.stringify(db, null, 2));
    g.__petalyaPublic = null;
    g.__petalyaOrderIds = null;
    return out;
  };
  const p = (g.__petalyaLock ?? Promise.resolve()).then(run, run);
  g.__petalyaLock = p.catch(() => undefined);
  return p;
}

/**
 * Cheap fingerprint of db.json (one stat call). Anonymous page views must not each re-read and re-parse the whole
 * database: it holds every order and customer and only grows. Derived, read-only views are rebuilt only when this
 * changes (db.json is replaced atomically on every write, so mtime/size change with it).
 */
async function dbKey() {
  await ensure();
  const st = await fs.stat(DB_FILE);
  return `${st.mtimeMs}:${st.size}`;
}

export async function getPublicData(): Promise<PublicData> {
  const key = await dbKey();
  if (g.__petalyaPublic?.key === key) return g.__petalyaPublic.value;
  const db = await readDB();
  const byOrder = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort;
  const value: PublicData = {
    categories: [...db.categories].sort(byOrder),
    products: db.products.filter((p) => p.active).sort(byOrder),
    gallery: db.gallery.filter((x) => x.active).sort(byOrder),
    // The order code a review belongs to is internal (it plus a phone number finds an order): never public.
    reviews: db.reviews.filter((r) => r.status === 'approved').map(({ orderCode: _code, ...r }) => r),
    reviewShots: db.reviewShots,
    settings: db.settings,
  };
  // `key` was taken BEFORE the read, so if the file changed in between the next call just rebuilds.
  g.__petalyaPublic = { key, value };
  return value;
}

/**
 * Does an order with this id exist? Answered from a cached id set, so a stranger guessing order ids costs a stat
 * call and a set lookup instead of a full database parse per guess.
 */
export async function orderExists(id: string): Promise<boolean> {
  const key = await dbKey();
  if (g.__petalyaOrderIds?.key !== key) g.__petalyaOrderIds = { key, value: new Set((await readDB()).orders.map((o) => o.id)) };
  return g.__petalyaOrderIds.value.has(id);
}

/* ---------- analytics events (append-only log, bounded) ---------- */

const retention = () => retentionFromEnv(process.env);

/** Appends and rewrites of events.jsonl take turns, so a clean-up can never lose an event that arrives mid-way. */
function withEventsLock<T>(fn: () => Promise<T>): Promise<T> {
  const p = (g.__petalyaEventsLock ?? Promise.resolve()).then(fn, fn);
  g.__petalyaEventsLock = p.catch(() => undefined);
  return p;
}

async function eventsSize() {
  try {
    return (await fs.stat(EVENTS_FILE)).size;
  } catch {
    return 0;
  }
}

/** Drops events older than the retention window and, if still too big, the oldest ones. Call inside the events lock. */
async function compactEventsLocked() {
  let raw = '';
  try {
    raw = await fs.readFile(EVENTS_FILE, 'utf8');
  } catch {
    return;
  }
  const cfg = retention();
  const { kept, dropped } = compactEventLines(raw.split('\n'), Date.now(), cfg.eventsRetentionMs, cfg.eventsMaxBytes);
  if (dropped > 0) await writeFileAtomic(EVENTS_FILE, kept.length ? kept.join('\n') + '\n' : '');
}

/**
 * Bounded: when the log reaches EVENTS_MAX_MB the oldest events are dropped to make room (it behaves like a ring
 * buffer), and events past EVENTS_RETENTION_DAYS are dropped too. Returns false (storing nothing) only if the log is
 * still full after that. The clean-up runs lazily, at most once per MAINTENANCE_INTERVAL_SECONDS and whenever the
 * ceiling is reached, so there is no timer to run.
 */
export async function appendEvents(events: TrackEvent[]): Promise<boolean> {
  await ensure();
  if (!events.length) return true;
  return withEventsLock(async () => {
    const cfg = retention();
    const m = (g.__petalyaEventsMaint ??= { last: 0, warned: false });
    let size = await eventsSize();
    if (size >= cfg.eventsMaxBytes || Date.now() - m.last >= cfg.maintenanceIntervalMs) {
      m.last = Date.now();
      await compactEventsLocked();
      size = await eventsSize();
    }
    if (size >= cfg.eventsMaxBytes) {
      if (!m.warned) {
        m.warned = true;
        console.warn('[events] events.jsonl is at its size ceiling (EVENTS_MAX_MB); new analytics events are being dropped until old ones age out.');
      }
      return false;
    }
    m.warned = false;
    await fs.appendFile(EVENTS_FILE, events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
    return true;
  });
}

/** Events since `sinceMs`, read line by line (the file is never held in memory as one string). */
export async function readEvents(sinceMs = 0): Promise<TrackEvent[]> {
  await ensure();
  const out: TrackEvent[] = [];
  try {
    await fs.access(EVENTS_FILE);
  } catch {
    return out;
  }
  const rl = readline.createInterface({ input: createReadStream(EVENTS_FILE, { encoding: 'utf8' }), crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      if (!line) continue;
      try {
        const e = JSON.parse(line) as TrackEvent;
        if (e.t >= sinceMs) out.push(e);
      } catch {}
    }
  } catch {
    // the file was replaced mid-read: return what was read
  }
  return out;
}

export async function rewriteEvents(filter: (e: TrackEvent) => boolean) {
  return withEventsLock(async () => {
    const all = await readEvents();
    await writeFileAtomic(EVENTS_FILE, all.filter(filter).map((e) => JSON.stringify(e)).join('\n') + (all.length ? '\n' : ''));
  });
}
