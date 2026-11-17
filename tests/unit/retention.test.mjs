// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { retentionFromEnv, isRefUpload, planUploadSweep, refUsage, compactEventLines } from '../../lib/retention.ts';

const DAY = 864e5;
const MB = 1024 * 1024;

test('config: documented defaults', () => {
  const c = retentionFromEnv({});
  assert.equal(c.refMaxAgeMs, 14 * DAY);
  assert.equal(c.refQuotaBytes, 300 * MB);
  assert.equal(c.eventsRetentionMs, 180 * DAY);
  assert.equal(c.eventsMaxBytes, 50 * MB);
  assert.equal(c.maintenanceIntervalMs, 3600_000);
});

test('config: overrides, fractions, and bad values falling back', () => {
  const c = retentionFromEnv({ REF_UPLOAD_QUOTA_MB: '2', EVENTS_MAX_MB: '0.25', REF_UPLOAD_MAX_AGE_DAYS: '0.5', MAINTENANCE_INTERVAL_SECONDS: '1' });
  assert.equal(c.refQuotaBytes, 2 * MB);
  assert.equal(c.eventsMaxBytes, 0.25 * MB);
  assert.equal(c.refMaxAgeMs, 0.5 * DAY);
  assert.equal(c.maintenanceIntervalMs, 1000);
  for (const bad of ['0', '-5', 'abc', '', ' ', 'NaN', 'Infinity', '1e999']) {
    const d = retentionFromEnv({ REF_UPLOAD_QUOTA_MB: bad, EVENTS_MAX_MB: bad, REF_UPLOAD_MAX_AGE_DAYS: bad, EVENTS_RETENTION_DAYS: bad, MAINTENANCE_INTERVAL_SECONDS: bad });
    assert.equal(d.refQuotaBytes, 300 * MB, bad);
    assert.equal(d.eventsMaxBytes, 50 * MB, bad);
    assert.equal(d.refMaxAgeMs, 14 * DAY, bad);
    assert.equal(d.eventsRetentionMs, 180 * DAY, bad);
    assert.equal(d.maintenanceIntervalMs, 3600_000, bad);
  }
});

test('only the public upload route\'s file names count as customer photos', () => {
  for (const ok of ['ref-mwet6o3s-e2y4thffq7.png', 'ref-a1-b2.webp', 'ref-zz-yy.jpg', 'ref-1-2.avif']) assert.equal(isRefUpload(ok), true, ok);
  for (const no of ['mwet6o3s-e2y4th.webp', 'ref-.png', 'ref-a-b.gif', 'ref-a-b.svg', '../ref-a-b.png', 'ref-a-b.png/x', 'REF-a-b.png', 'ref-a-b.png.exe', 'sub/ref-a-b.png']) assert.equal(isRefUpload(no), false, no);
});

const f = (name, size, ageDays, now) => ({ name, size, mtimeMs: now - ageDays * DAY });

test('sweep: deletes old UNUSED customer photos, keeps used, young, admin and unrelated files', () => {
  const now = 10 * DAY;
  const files = [
    f('ref-old-unused.png', 100, 20, now),
    f('ref-old-used.png', 100, 20, now),
    f('ref-young-unused.png', 100, 1, now),
    f('adminphoto-abc.webp', 100, 400, now), // admin upload, never swept
    f('notes.txt', 100, 400, now),
    f('ref-edge-unused.webp', 100, 14, now), // exactly at the age limit: goes
  ];
  const doomed = planUploadSweep(files, new Set(['ref-old-used.png']), now, 14 * DAY);
  assert.deepEqual(doomed.sort(), ['ref-edge-unused.webp', 'ref-old-unused.png']);
});

test('sweep: a shorter pressure window frees more, but still never touches used photos', () => {
  const now = 10 * DAY;
  const files = [f('ref-a-b.png', 1, 2, now), f('ref-c-d.png', 1, 0.5, now), f('ref-e-f.png', 1, 2, now)];
  assert.deepEqual(planUploadSweep(files, new Set(['ref-e-f.png']), now, 1 * DAY), ['ref-a-b.png']);
});

test('usage counts customer photos only', () => {
  assert.equal(refUsage([{ name: 'ref-a-b.png', size: 10, mtimeMs: 0 }, { name: 'admin.webp', size: 1000, mtimeMs: 0 }, { name: 'ref-c-d.jpg', size: 5, mtimeMs: 0 }]), 15);
  assert.equal(refUsage([]), 0);
});

const ev = (t, extra = '') => JSON.stringify({ t, type: 'page_view', sid: 'x', ...(extra ? { meta: { k: extra } } : {}) });

test('events: lines older than the retention window are dropped, newer ones kept in order', () => {
  const now = 1000 * DAY;
  const lines = [ev(now - 200 * DAY), ev(now - 181 * DAY), ev(now - 179 * DAY), ev(now - DAY), ev(now)];
  const r = compactEventLines(lines, now, 180 * DAY, 30 * MB);
  assert.deepEqual(r.kept, [lines[2], lines[3], lines[4]]);
  assert.equal(r.dropped, 2);
});

test('events: corrupt, empty and timestamp-less lines are dropped, valid ones survive', () => {
  const now = 1000 * DAY;
  const good = ev(now);
  const r = compactEventLines(['', '{broken', '{"type":"x"}', '{"t":"yesterday"}', 'null', good, ''], now, DAY, MB);
  assert.deepEqual(r.kept, [good]);
});

test('events: over the ceiling, the OLDEST lines go until the file is at 80 % or less, newest always kept', () => {
  const now = 1000 * DAY;
  const lines = Array.from({ length: 1000 }, (_, i) => ev(now - (1000 - i) * 1000, 'x'.repeat(50)));
  const total = lines.reduce((a, l) => a + Buffer.byteLength(l) + 1, 0);
  const max = Math.floor(total * 0.9); // current size is above the ceiling
  const r = compactEventLines(lines, now, 180 * DAY, max);
  assert.ok(r.bytes <= max * 0.8, `${r.bytes} > ${max * 0.8}`);
  assert.ok(r.kept.length > 0 && r.kept.length < lines.length);
  assert.equal(r.kept[r.kept.length - 1], lines[lines.length - 1], 'the newest event is kept');
  assert.deepEqual(r.kept, lines.slice(lines.length - r.kept.length), 'what is kept is a contiguous newest tail');
});

test('events: a file already under the ceiling and inside retention is returned untouched', () => {
  const now = 1000 * DAY;
  const lines = [ev(now - 5 * DAY), ev(now - DAY), ev(now)];
  const r = compactEventLines(lines, now, 180 * DAY, 30 * MB);
  assert.deepEqual(r.kept, lines);
  assert.equal(r.dropped, 0);
});

test('events: utf-8 is counted in bytes, not characters', () => {
  const now = 1000 * DAY;
  const lines = [ev(now - 2000, 'ج'.repeat(100)), ev(now - 1000, 'ج'.repeat(100)), ev(now, 'ج'.repeat(100))];
  const one = Buffer.byteLength(lines[0]) + 1;
  const r = compactEventLines(lines, now, DAY, Math.floor(one * 2.5)); // 3 lines do not fit under 80 % of 2.5 lines
  assert.ok(r.bytes <= one * 2.5 * 0.8 + 1);
  assert.equal(r.kept[r.kept.length - 1], lines[2]);
});

test('source guard: every writer of events.jsonl goes through the lock and the ceiling; public pages avoid a full database parse', () => {
  const read = (p) => fs.readFileSync(path.resolve(import.meta.dirname, '../..', p), 'utf8');
  const db = read('lib/db.ts');
  assert.match(db, /appendFile\(EVENTS_FILE/);
  assert.equal((db.match(/appendFile\(/g) || []).length, 1, 'exactly one place appends to the events log');
  assert.match(db, /return withEventsLock\(async \(\) => \{\s*const cfg = retention\(\);/);
  assert.match(db, /export async function rewriteEvents\([^{]*\{\s*return withEventsLock/);
  assert.ok(!/readFile\(EVENTS_FILE/.test(db.split('export async function readEvents')[1] ?? ''), 'readEvents must stream, not readFile the whole log');
  assert.match(read('app/api/upload/route.ts'), /storage_full/);
  assert.match(read('app/api/orders/[id]/route.ts'), /orderExists/);
  assert.match(read('app/(site)/order/[id]/page.tsx'), /orderExists/);
  assert.ok(!/readDB/.test(read('app/(site)/p/[id]/page.tsx')), 'public product page must use the cached public view');
  assert.ok(!/readDB/.test(read('app/sitemap.ts')), 'sitemap must use the cached public view');
});
