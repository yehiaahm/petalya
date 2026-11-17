// End-to-end regression tests for PT-06 (unbounded storage growth and per-request full-database reads).
//
// This file starts ITS OWN server on a spare port with tiny limits and a throw-away data folder, so it does not
// depend on (or disturb) the server the other tests use. It needs a production build (`npm run build`) and must be
// run from the project root, which `npm run test:integration` does.
//   limits used here: photo quota 2 MB, photo max age ~2.6 s, events ceiling 0.25 MB, events retention 1 day,
//   clean-up allowed every 1 s.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3112;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = process.cwd();
const ADMIN = { user: 'storageadmin', pass: 'Synth-Storage-Pass-2026' };
const MB = 1024 * 1024;
const DAY = 864e5;

let server;
let dataDir;
let log = '';

let n = (Math.floor(Math.random() * 200) + 1) + 1600;
const client = () => `198.51.${(n >> 8) & 255}.${(n++ & 255) || 1}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cookieOf = (r, name) => r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith(name + '='));

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petalya-storage-test-'));
  server = spawn(process.execPath, [path.join('node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      PETALYA_DATA_DIR: dataDir,
      ADMIN_USERNAME: ADMIN.user,
      ADMIN_PASSWORD: ADMIN.pass,
      SESSION_SECRET: 'synthetic-storage-test-secret-0123456789abcdef0123456789abcdef',
      REF_UPLOAD_QUOTA_MB: '2',
      REF_UPLOAD_MAX_AGE_DAYS: '0.00003',
      EVENTS_MAX_MB: '0.25',
      EVENTS_RETENTION_DAYS: '1',
      MAINTENANCE_INTERVAL_SECONDS: '1',
    },
  });
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(BASE + '/api/health')).ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error('test server did not start:\n' + log.slice(-800));
});

after(() => {
  server?.kill();
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {}
});

const png = (bytes) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(bytes, 7)]);
async function upload(bytes) {
  const fd = new FormData();
  fd.set('file', new Blob([png(bytes)], { type: 'image/png' }), 'ref.png');
  const r = await fetch(BASE + '/api/upload', { method: 'POST', headers: { 'x-forwarded-for': client() }, body: fd });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, url: j.url, error: j.error };
}
const uploadsOnDisk = () => fs.readdirSync(path.join(dataDir, 'uploads')).filter((f) => f.startsWith('ref-'));
const get = async (p, cookie) => (await fetch(BASE + p, { headers: cookie ? { cookie } : {} })).status;

async function adminCookie() {
  const r = await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': client() }, body: JSON.stringify({ username: ADMIN.user, password: ADMIN.pass }) });
  assert.equal(r.status, 200);
  return cookieOf(r, 'petalya_admin');
}

/* ---------- customer photos ---------- */

test('photo quota: uploads are accepted until 2 MB is used, then refused with 507 storage_full', async () => {
  const a = await upload(700_000);
  const b = await upload(700_000);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  const c = await upload(700_000);
  assert.equal(c.status, 507, JSON.stringify(c));
  assert.equal(c.error, 'storage_full');
  assert.equal(await get('/api/health'), 200);
});

test('abandoned photos are cleaned up, used ones are kept, and admin uploads are never touched', async () => {
  const cookie = await adminCookie();

  // an admin photo (not a customer photo) that must survive every sweep
  const fd = new FormData();
  fd.set('file', new Blob([Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2000, 1)])], { type: 'image/jpeg' }), 'p.jpg');
  const adminUp = await fetch(BASE + '/api/admin/upload', { method: 'POST', headers: { cookie, 'x-forwarded-for': client() }, body: fd });
  assert.equal(adminUp.status, 200);
  const adminUrl = (await adminUp.json()).url;

  // the two uploads from the previous test are abandoned. Wait past the (tiny) max age and let a sweep run.
  const before = uploadsOnDisk();
  assert.ok(before.length >= 2);
  await sleep(3500);

  // a photo that WILL be used by an order, uploaded now but aged past the limit before the sweep
  const used = await upload(1000);
  assert.equal(used.status, 200, JSON.stringify(used));
  const day = new Date(Date.now() + 5 * DAY).toISOString().slice(0, 10);
  const order = await fetch(BASE + '/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': client() },
    body: JSON.stringify({ lines: [{ kind: 'custom', design: {}, qty: 1 }], customer: { name: 'Synthetic Tester', phone: '01012345678' }, fulfillment: { type: 'pickup', date: day }, payment: 'cod', refImages: [used.url] }),
  });
  assert.equal(order.status, 200, await order.text());
  await sleep(3500); // now the used photo is older than the limit too

  // any upload triggers the lazy sweep (at most once a second); give it a moment to finish
  await upload(1000);
  await sleep(1500);
  await upload(1000);
  await sleep(1500);

  const left = new Set(uploadsOnDisk());
  const usedName = used.url.split('/').pop();
  assert.ok(left.has(usedName), 'a photo used by an order must be kept');
  for (const f of before) assert.ok(!left.has(f), `abandoned photo ${f} should have been deleted`);
  assert.equal(await get(adminUrl), 200, 'admin uploads are never swept');
  assert.equal(await get(used.url), 200);
});

test('after the sweep there is room again: a new photo is accepted', async () => {
  const r = await upload(700_000);
  assert.equal(r.status, 200, JSON.stringify(r));
});

/* ---------- analytics events ---------- */

const eventsFile = () => path.join(dataDir, 'events.jsonl');
const track = (events) => fetch(BASE + '/api/track', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': client() }, body: JSON.stringify(events) });

test('events file never outgrows its ceiling under a flood, the newest events survive, and the dashboard keeps working', async () => {
  const CAP = 0.25 * MB;
  const batch = (tag, i) => Array.from({ length: 25 }, (_, k) => ({ type: 'add_to_cart', sid: `${tag}${i}`, path: '/p/x', meta: { product: 'p'.repeat(40), k: `${tag}-${i}-${k}` } }));
  for (let i = 0; i < 160; i++) {
    const r = await track(batch('flood', i));
    assert.equal(r.status, 204);
    const size = fs.existsSync(eventsFile()) ? fs.statSync(eventsFile()).size : 0;
    assert.ok(size <= CAP + 16 * 1024, `events.jsonl reached ${size} bytes at request ${i}`);
  }
  const text = fs.readFileSync(eventsFile(), 'utf8');
  assert.ok(text.includes('flood159'), 'the newest events must be kept (oldest are dropped first)');
  assert.ok(!text.includes('"sid":"flood0"'), 'the oldest events were dropped to make room');
  const cookie = await adminCookie();
  assert.equal(await get('/admin/analytics', cookie), 200);
  assert.equal(await get('/admin', cookie), 200);
});

test('events older than the retention window are dropped by the next clean-up, recent ones are kept', async () => {
  const old = JSON.stringify({ t: Date.now() - 3 * DAY, type: 'page_view', sid: 'ancient-marker', path: '/' });
  const fresh = JSON.stringify({ t: Date.now() - 1000, type: 'page_view', sid: 'recent-marker', path: '/' });
  fs.appendFileSync(eventsFile(), old + '\n' + fresh + '\n');
  await sleep(1300); // past the 1 s maintenance interval
  assert.equal((await track([{ type: 'page_view', sid: 'trigger-marker', path: '/' }])).status, 204);
  const text = fs.readFileSync(eventsFile(), 'utf8');
  assert.ok(!text.includes('ancient-marker'), 'older than retention must be gone');
  assert.ok(text.includes('recent-marker') && text.includes('trigger-marker'));
});

test('no event is lost when requests arrive while clean-ups are running', async () => {
  await sleep(1300);
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) => track([{ type: 'page_view', sid: `burst-${i}`, path: '/' }]).then((r) => r.status)));
  assert.ok(results.every((s) => s === 204));
  const text = fs.readFileSync(eventsFile(), 'utf8');
  for (let i = 0; i < 30; i++) assert.ok(text.includes(`"sid":"burst-${i}"`), `burst-${i} missing`);
});

/* ---------- cached public views must never serve stale data ---------- */

test('cached public views are refreshed the moment the owner changes something', async () => {
  const cookie = await adminCookie();
  const json = (method, p, body) => fetch(BASE + p, { method, headers: { 'content-type': 'application/json', cookie, 'x-forwarded-for': client() }, body: JSON.stringify(body) });

  const created = await (await json('POST', '/api/admin/products', { name: { ar: 'منتج اختبار تخزين', en: 'Storage Probe One' }, desc: { ar: 'وصف', en: 'desc' }, price: 123, images: [] })).json();
  const id = created.id;
  assert.ok(id);
  assert.equal(await get(`/p/${id}`), 200, 'new product visible at once');
  assert.ok((await (await fetch(BASE + '/sitemap.xml')).text()).includes(`/p/${id}`), 'sitemap lists it');
  assert.ok((await (await fetch(BASE + '/')).text()).includes('Storage Probe One'), 'home page lists it');

  const renamed = await json('PATCH', `/api/admin/products/${id}`, { name: { ar: 'منتج', en: 'Storage Probe Two' } });
  assert.equal(renamed.status, 200);
  const page = await (await fetch(BASE + `/p/${id}`)).text();
  assert.ok(page.includes('Storage Probe Two') && !page.includes('Storage Probe One'), 'rename visible at once');

  const hidden = await json('PATCH', `/api/admin/products/${id}`, { active: false });
  assert.equal(hidden.status, 200);
  assert.equal(await get(`/p/${id}`), 404, 'hidden product disappears at once');
  assert.ok(!(await (await fetch(BASE + '/sitemap.xml')).text()).includes(`/p/${id}`));
});

test('order ids: a new order is found at once, a guessed id is a cheap 404, the page and the API agree', async () => {
  const day = new Date(Date.now() + 5 * DAY).toISOString().slice(0, 10);
  const r = await fetch(BASE + '/api/orders', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': client() }, body: JSON.stringify({ lines: [{ kind: 'custom', design: {}, qty: 1 }], customer: { name: 'Synthetic Tester', phone: '01012345678' }, fulfillment: { type: 'pickup', date: day }, payment: 'cod' }) });
  assert.equal(r.status, 200);
  const { id } = await r.json();
  assert.equal(await get(`/api/orders/${id}`), 200);
  assert.equal(await get(`/order/${id}`), 200);
  for (let i = 0; i < 40; i++) {
    const guess = 'ZZZZ' + String(i).padStart(8, '2');
    assert.equal(await get(`/api/orders/${guess}`), 404);
    assert.equal(await get(`/order/${guess}`), 404);
  }
  assert.equal(await get(`/api/orders/${id}`), 200, 'real id still fine after the guesses');
});

test('server log shows no errors from any of the above', () => {
  const bad = log.split('\n').filter((l) => /\b(error|exception|unhandled)\b/i.test(l) && !/Request body exceeded/.test(l));
  assert.deepEqual(bad, []);
});
