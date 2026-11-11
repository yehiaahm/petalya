import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DB, PublicData, TrackEvent } from './types';
import { createSeed, defaultReviewShots, defaultSettings } from './seed';
import { AR_COPY_UPDATES } from './copy-updates';

export const DATA_DIR = process.env.PETALYA_DATA_DIR || path.join(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');

type G = { __petalyaLock?: Promise<unknown>; __petalyaInit?: Promise<void> };
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
  db.push ??= { subs: [] };
  db.push.subs ??= [];
  db.reviewShots ??= defaultReviewShots();
  reviseSeedCopy(db);
  return db;
}

/** Swaps untouched seed wording for the revised Arabic copy (see copy-updates.ts). Edited text is never matched. */
function reviseSeedCopy(db: DB) {
  const fix = (l?: { ar: string } | null, map: Map<string, string> = AR_COPY_UPDATES.text) => {
    const next = l && map.get(l.ar);
    if (next) l.ar = next;
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
    return out;
  };
  const p = (g.__petalyaLock ?? Promise.resolve()).then(run, run);
  g.__petalyaLock = p.catch(() => undefined);
  return p;
}

export async function getPublicData(): Promise<PublicData> {
  const db = await readDB();
  const byOrder = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort;
  return {
    categories: [...db.categories].sort(byOrder),
    products: db.products.filter((p) => p.active).sort(byOrder),
    gallery: db.gallery.filter((x) => x.active).sort(byOrder),
    reviews: db.reviews.filter((r) => r.status === 'approved'),
    reviewShots: db.reviewShots,
    settings: db.settings,
  };
}

/* ---------- analytics events (append-only log) ---------- */

export async function appendEvents(events: TrackEvent[]) {
  await ensure();
  if (!events.length) return;
  await fs.appendFile(EVENTS_FILE, events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
}

export async function readEvents(sinceMs = 0): Promise<TrackEvent[]> {
  await ensure();
  let raw = '';
  try {
    raw = await fs.readFile(EVENTS_FILE, 'utf8');
  } catch {
    return [];
  }
  const out: TrackEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try {
      const e = JSON.parse(line) as TrackEvent;
      if (e.t >= sinceMs) out.push(e);
    } catch {}
  }
  return out;
}

export async function rewriteEvents(filter: (e: TrackEvent) => boolean) {
  const all = await readEvents();
  await writeFileAtomic(EVENTS_FILE, all.filter(filter).map((e) => JSON.stringify(e)).join('\n') + (all.length ? '\n' : ''));
}
