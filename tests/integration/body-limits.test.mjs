// End-to-end regression tests for PT-04 (request-size limits bypassed with chunked bodies).
//
// Uses raw node:http so the request really is `Transfer-Encoding: chunked` with NO Content-Length.
//   BASE_URL=http://127.0.0.1:3111 TEST_ADMIN_USER=... TEST_ADMIN_PASS=... npm run test:integration
// Run against a local production build with synthetic data only. Largest body sent: 12 MB.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

const BASE = new URL(process.env.BASE_URL || 'http://127.0.0.1:3111');
const ADMIN_USER = process.env.TEST_ADMIN_USER;
const ADMIN_PASS = process.env.TEST_ADMIN_PASS;
const MB = 1024 * 1024;

let n = (Math.floor(Math.random() * 200) + 1) + 400; // different range from ip-spoofing tests
const client = () => `198.51.${(n >> 8) & 255}.${(n++ & 255) || 1}`;

/** POST `total` bytes produced by `gen(i)` as chunks of `chunk` bytes, chunked encoding, no Content-Length. */
async function chunkedPost(pathname, { headers = {}, total, chunk = 64 * 1024, first = null, method = 'POST' }) {
  const req = http.request({ host: BASE.hostname, port: BASE.port, path: pathname, method, headers: { 'transfer-encoding': 'chunked', 'x-forwarded-for': client(), ...headers } });
  let status = null;
  let text = '';
  const done = new Promise((resolve) => {
    req.on('response', (res) => {
      status = res.statusCode;
      res.on('data', (d) => (text += d));
      res.on('end', () => resolve());
    });
    req.on('error', () => resolve());
  });
  let sent = 0;
  try {
    if (first) {
      req.write(first);
      sent += first.length;
    }
    while (sent < total && status === null) {
      const piece = Buffer.alloc(Math.min(chunk, total - sent), 0x20);
      sent += piece.length;
      if (!req.write(piece)) await Promise.race([once(req, 'drain'), done]);
    }
    req.end();
  } catch {}
  await done;
  return { status, text, sent };
}

async function json(pathname, body, headers = {}) {
  const r = await fetch(BASE + pathname.replace(/^\//, ''), { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': client(), ...headers }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}

const health = async () => (await fetch(new URL('/api/health', BASE))).status;

test('chunked 100 KB to a small-body endpoint (limit 16 KB) is refused with 413', async () => {
  const r = await chunkedPost('/api/coupons', { headers: { 'content-type': 'application/json' }, first: Buffer.from('{"code":"X","pad":"'), total: 100 * 1024 });
  assert.equal(r.status, 413, r.text);
});

test('chunked 300 KB order (limit 256 KB) is refused with 413', async () => {
  const r = await chunkedPost('/api/orders', { headers: { 'content-type': 'application/json' }, first: Buffer.from('{"lines":[],"pad":"'), total: 300 * 1024 });
  assert.equal(r.status, 413, r.text);
});

test('chunked login body well over 16 KB is refused before any password work', async () => {
  const r = await chunkedPost('/api/auth/login', { headers: { 'content-type': 'application/json' }, first: Buffer.from('{"email":"a@b.co","password":"'), total: 64 * 1024 });
  assert.equal(r.status, 413, r.text);
});

test('chunked 7 MB multipart to the public upload (limit 6 MB) is refused with 413', async () => {
  const r = await chunkedPost('/api/upload', { headers: { 'content-type': 'multipart/form-data; boundary=xx' }, first: Buffer.from('--xx\r\ncontent-disposition: form-data; name="pad"\r\n\r\n'), total: 7 * MB });
  assert.equal(r.status, 413, r.text);
});

test('chunked 12 MB body is refused with 413 and the server stays healthy', async () => {
  const r = await chunkedPost('/api/track', { headers: { 'content-type': 'application/json' }, first: Buffer.from('[{"type":"page_view","pad":"'), total: 12 * MB });
  assert.equal(r.status, 413, r.text);
  assert.equal(await health(), 200);
});

// Note: Next.js itself reads the request through its proxy layer first (buffering at most 10 MB and discarding the
// rest), so the socket is drained even though the handler stops at its own ceiling. What this test guarantees is the
// application-level outcome: a 413, no processing of the body, and a server that stays up.
test('a 64 MB chunked body is answered 413 without being processed, and the server stays healthy', async () => {
  const r = await chunkedPost('/api/coupons', { headers: { 'content-type': 'application/json' }, first: Buffer.from('{"pad":"'), total: 64 * MB });
  assert.equal(r.status, 413);
  assert.equal(await health(), 200);
});

test('Content-Length framed oversized body is still refused early', async () => {
  const body = JSON.stringify({ code: 'X', pad: 'x'.repeat(100 * 1024) });
  const r = await fetch(new URL('/api/coupons', BASE), { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': client() }, body });
  assert.equal(r.status, 413);
});

test('normal requests are unaffected: small chunked JSON, normal coupon check, normal order', async () => {
  const small = await chunkedPost('/api/coupons', { headers: { 'content-type': 'application/json' }, first: Buffer.from('{"code":"NOPE"}'), total: 15 });
  assert.equal(small.status, 200);
  assert.deepEqual(JSON.parse(small.text), { ok: false, reason: 'invalid' });

  const c = await json('/api/coupons', { code: 'NOPE', subtotal: 100 });
  assert.equal(c.status, 200);

  const day = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  const o = await json('/api/orders', { lines: [{ kind: 'custom', design: {}, qty: 1 }], customer: { name: 'Synthetic Tester', phone: '01012345678' }, fulfillment: { type: 'pickup', date: day }, payment: 'cod' });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.ok(o.body.id && o.body.code);
});

test('a realistic 3.5 MB reference photo still uploads (under the 4 MB file cap)', async () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(3.5 * MB, 1)]);
  const fd = new FormData();
  fd.set('file', new Blob([png], { type: 'image/png' }), 'ref.png');
  const r = await fetch(new URL('/api/upload', BASE), { method: 'POST', headers: { 'x-forwarded-for': client() }, body: fd });
  assert.equal(r.status, 200, await r.text());
});

test('invalid JSON is still answered like before (not as "too big")', async () => {
  const r = await chunkedPost('/api/coupons', { headers: { 'content-type': 'application/json' }, first: Buffer.from('{broken'), total: 7 });
  assert.equal(r.status, 200);
});

test('admin: a normal settings save works, an oversized chunked one is refused and settings are NOT changed', { skip: !ADMIN_USER || !ADMIN_PASS }, async () => {
  const login = await fetch(new URL('/api/admin/login', BASE), { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': client() }, body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  const cur = await (await fetch(new URL('/api/admin/summary', BASE), { headers: { cookie } })).json();
  assert.ok('newOrders' in cur);

  const settings = (await (await fetch(new URL('/admin/settings', BASE), { headers: { cookie } })).text()).length;
  assert.ok(settings > 1000);

  // oversized (3 MB > 2 MB admin ceiling), chunked, authenticated
  const r = await chunkedPost('/api/admin/settings', { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, first: Buffer.from('{"whatsapp":"201000000999","pad":"'), total: 3 * MB });
  assert.equal(r.status, 413, r.text);

  const after = await (await fetch(new URL('/admin/settings', BASE), { headers: { cookie } })).text();
  assert.ok(!after.includes('201000000999'), 'settings must not have been modified by the refused request');
});
