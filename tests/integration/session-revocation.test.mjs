// End-to-end regression tests for PT-05 (a logged-out or stolen session cookie stayed valid until it expired).
//
//   BASE_URL=http://127.0.0.1:3111 TEST_ADMIN_USER=... TEST_ADMIN_PASS=... [TEST_SESSION_SECRET=...] npm run test:integration
// Synthetic data only. TEST_SESSION_SECRET (the server's SESSION_SECRET) is optional; it enables the forged-token tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3111';
const USER = process.env.TEST_ADMIN_USER;
const PASS = process.env.TEST_ADMIN_PASS;
const SECRET = process.env.TEST_SESSION_SECRET;
const skipAdmin = !USER || !PASS;

let n = (Math.floor(Math.random() * 200) + 1) + 1200;
const client = () => `198.51.${(n >> 8) & 255}.${(n++ & 255) || 1}`;
const cookieOf = (r, name) => r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith(name + '='));

async function call(method, path, { cookie = '', body } = {}) {
  const r = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': client(), ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, res: r };
}

/* ---------- admin ---------- */
async function adminSession(password = PASS) {
  const r = await call('POST', '/api/admin/login', { body: { username: USER, password } });
  assert.equal(r.status, 200, 'admin login');
  return cookieOf(r.res, 'petalya_admin');
}
const adminAlive = async (cookie) => (await call('GET', '/api/admin/summary', { cookie })).status === 200;

test('admin: logging out one browser really revokes THAT session, even if the old cookie is replayed; other browsers stay signed in', { skip: skipAdmin }, async () => {
  const a = await adminSession();
  const b = await adminSession();
  assert.ok(await adminAlive(a) && await adminAlive(b));
  const out = await call('POST', '/api/admin/logout', { cookie: a });
  assert.equal(out.status, 200);
  assert.equal(await adminAlive(a), false, 'the replayed cookie of the logged-out browser must be dead');
  assert.equal(await adminAlive(b), true, 'the other browser must be unaffected');
});

test('admin: an anonymous or forged logout (even with all:true) cannot sign the owner out', { skip: skipAdmin }, async () => {
  const s = await adminSession();
  for (const cookie of ['', 'petalya_admin=garbage', 'petalya_admin=a.b', `petalya_admin=${'A'.repeat(30)}.${'B'.repeat(43)}`]) {
    for (const body of [undefined, {}, { all: true }]) {
      const r = await call('POST', '/api/admin/logout', { cookie, body });
      assert.equal(r.status, 200);
    }
  }
  assert.equal(await adminAlive(s), true);
});

test('admin: "sign out everywhere" revokes every session, including ones on other devices', { skip: skipAdmin }, async () => {
  const [a, b, c] = [await adminSession(), await adminSession(), await adminSession()];
  const r = await call('POST', '/api/admin/logout', { cookie: b, body: { all: true } });
  assert.equal(r.status, 200);
  for (const [name, ck] of [['a', a], ['b', b], ['c', c]]) assert.equal(await adminAlive(ck), false, `session ${name} must be revoked`);
});

test('admin: changing the password revokes the other sessions, keeps the changer signed in; password restored afterwards', { skip: skipAdmin }, async () => {
  const TMP = 'Temp-Revoke-Pass-2026-pt05';
  const other = await adminSession();
  const mine = await adminSession();
  const r1 = await call('POST', '/api/admin/password', { cookie: mine, body: { current: PASS, next: TMP } });
  assert.equal(r1.status, 200);
  const mine2 = cookieOf(r1.res, 'petalya_admin');
  assert.equal(await adminAlive(other), false, 'other browser revoked');
  assert.equal(await adminAlive(mine), false, 'the pre-change cookie is replaced');
  assert.equal(await adminAlive(mine2), true, 'the changer stays signed in');
  const r2 = await call('POST', '/api/admin/password', { cookie: mine2, body: { current: TMP, next: PASS } });
  assert.equal(r2.status, 200);
  assert.equal(await adminAlive(cookieOf(r2.res, 'petalya_admin')), true);
});

test('admin: tokens from before the change (no session id) and tokens naming an unknown session are rejected even when correctly signed', { skip: skipAdmin || !SECRET }, async () => {
  const live = await adminSession();
  const payload = JSON.parse(Buffer.from(live.split('=')[1].split('.')[0], 'base64url').toString());
  const mint = (obj) => {
    const p = Buffer.from(JSON.stringify(obj)).toString('base64url');
    return `petalya_admin=${p}.${createHmac('sha256', SECRET).update(p).digest('base64url')}`;
  };
  const { sid: _sid, ...legacy } = payload;
  assert.equal(await adminAlive(mint(legacy)), false, 'legacy token without sid');
  assert.equal(await adminAlive(mint({ ...payload, sid: 'Z'.repeat(24) })), false, 'unknown sid');
  assert.equal(await adminAlive(mint({ ...payload, sid: 5 })), false, 'non-string sid');
  assert.equal(await adminAlive(live), true, 'control: the genuine token still works');
});

/* ---------- customers ---------- */
const PW = 'Correct-Horse-Battery-9';
async function newCustomer() {
  const email = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const reg = await call('POST', '/api/auth/register', { body: { name: 'Synthetic Reviewer', email, password: PW } });
  assert.equal(reg.status, 200, JSON.stringify(reg.json));
  return { email, id: reg.json.user.id, first: cookieOf(reg.res, 'petalya_user') };
}
async function customerLogin(email, password = PW) {
  const r = await call('POST', '/api/auth/login', { body: { email, password } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return cookieOf(r.res, 'petalya_user');
}
const custAlive = async (cookie) => (await call('PATCH', '/api/account', { cookie, body: { name: 'Synthetic Reviewer' } })).status === 200;

test('customer: logging out one browser revokes that session (replayed cookie is dead); the other browser stays signed in', async () => {
  const u = await newCustomer();
  const d1 = u.first;
  const d2 = await customerLogin(u.email);
  assert.ok(await custAlive(d1) && await custAlive(d2));
  assert.equal((await call('POST', '/api/auth/logout', { cookie: d1 })).status, 200);
  assert.equal(await custAlive(d1), false);
  assert.equal(await custAlive(d2), true);
});

test('customer: anonymous or forged logout with all:true cannot sign a customer out', async () => {
  const u = await newCustomer();
  for (const cookie of ['', 'petalya_user=garbage', 'petalya_user=a.b']) assert.equal((await call('POST', '/api/auth/logout', { cookie, body: { all: true } })).status, 200);
  assert.equal(await custAlive(u.first), true);
});

test('customer: "sign out everywhere" revokes all of that account\'s sessions, and not another customer\'s', async () => {
  const u = await newCustomer();
  const v = await newCustomer();
  const d2 = await customerLogin(u.email);
  assert.equal((await call('POST', '/api/auth/logout', { cookie: d2, body: { all: true } })).status, 200);
  assert.equal(await custAlive(u.first), false);
  assert.equal(await custAlive(d2), false);
  assert.equal(await custAlive(v.first), true, 'a different customer is unaffected');
});

test('customer: changing the password revokes the other devices and keeps this one', async () => {
  const u = await newCustomer();
  const d1 = u.first;
  const d2 = await customerLogin(u.email);
  const r = await call('POST', '/api/account/password', { cookie: d1, body: { current: PW, next: 'Another-Pass-Word-77' } });
  assert.equal(r.status, 200);
  assert.equal(await custAlive(d2), false);
  assert.equal(await custAlive(d1), false, 'pre-change cookie replaced');
  assert.equal(await custAlive(cookieOf(r.res, 'petalya_user')), true);
});

test('customer: the owner resetting a customer\'s password signs that customer out everywhere', { skip: skipAdmin }, async () => {
  const u = await newCustomer();
  const d2 = await customerLogin(u.email);
  const admin = await adminSession();
  const r = await call('PATCH', `/api/admin/users/${u.id}`, { cookie: admin });
  assert.equal(r.status, 200);
  assert.equal(await custAlive(u.first), false);
  assert.equal(await custAlive(d2), false);
});

test('customer: forged session ids are rejected even when correctly signed', { skip: !SECRET }, async () => {
  const u = await newCustomer();
  const payload = JSON.parse(Buffer.from(u.first.split('=')[1].split('.')[0], 'base64url').toString());
  const mint = (obj) => {
    const p = Buffer.from(JSON.stringify(obj)).toString('base64url');
    return `petalya_user=${p}.${createHmac('sha256', 'customer:' + SECRET).update(p).digest('base64url')}`;
  };
  const { sid: _sid, ...legacy } = payload;
  assert.equal(await custAlive(mint(legacy)), false, 'legacy token without sid');
  assert.equal(await custAlive(mint({ ...payload, sid: 'Q'.repeat(24) })), false, 'unknown sid');
  assert.equal(await custAlive(u.first), true, 'control');
});
