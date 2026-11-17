// End-to-end regression tests for PT-02 (rate-limit / lockout bypass via forged client-IP headers).
//
// The test plays the part of the platform proxy: for a "client" it sends  X-Forwarded-For: <forged...>, <client>
// exactly as Railway's edge would after appending the address it saw. Run against a production build started
// with synthetic secrets and a throw-away data folder:
//
//   BASE_URL=http://127.0.0.1:3111 TEST_ADMIN_USER=... TEST_ADMIN_PASS=... npm run test:integration
//
// The server must run with TRUSTED_PROXY_HOPS=1 (the production default). Never point this at production data.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3111';
const ADMIN_USER = process.env.TEST_ADMIN_USER;
const ADMIN_PASS = process.env.TEST_ADMIN_PASS;

// documentation ranges (RFC 5737 / RFC 3849): can never be a real visitor
let n = Math.floor(Math.random() * 200) + 1;
const freshClient = () => `198.51.${(n >> 8) & 255}.${(n++ & 255) || 1}`;
const forged = (i) => `10.${i % 250}.${(i * 3) % 250}.${(i * 7) % 250}`;

async function post(path, body, headers) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  await r.arrayBuffer().catch(() => {});
  return r.status;
}
/** What the proxy would send for `client`, with `spoof` attempting to look like someone else. */
const viaProxy = (client, i = 0, extra = {}) => ({ 'x-forwarded-for': `${forged(i)}, ${forged(i + 1)}, ${client}`, 'x-real-ip': forged(i + 2), ...extra });

const lookup = (headers) => post('/api/orders/lookup', { code: 'PT-1001', phone: '01000000000' }, headers);

test('lookup limit (15 per 10 min) holds while x-real-ip and the x-forwarded-for prefix are rotated', async () => {
  const client = freshClient();
  const codes = [];
  for (let i = 0; i < 24; i++) codes.push(await lookup(viaProxy(client, i)));
  const limited = codes.filter((c) => c === 429).length;
  assert.equal(codes.slice(0, 15).filter((c) => c === 429).length, 0, 'first 15 must be allowed');
  assert.equal(limited, 9, `requests 16..24 must all be limited, got ${JSON.stringify(codes)}`);
});

test('a different real client is NOT throttled by someone else\'s traffic (functionality preserved)', async () => {
  const noisy = freshClient();
  for (let i = 0; i < 20; i++) await lookup(viaProxy(noisy, i));
  assert.equal(await lookup(viaProxy(noisy, 99)), 429);
  const other = freshClient();
  assert.equal(await lookup(viaProxy(other, 0)), 404, 'other client gets a normal answer');
});

test('proxy-chain manipulation: a 300-entry forged chain does not help', async () => {
  const client = freshClient();
  const codes = [];
  for (let i = 0; i < 18; i++) {
    const chain = Array.from({ length: 300 }, (_, k) => forged(i * 300 + k)).join(', ');
    codes.push(await lookup({ 'x-forwarded-for': `${chain}, ${client}` }));
  }
  assert.ok(codes.slice(15).every((c) => c === 429), JSON.stringify(codes));
});

test('proxy-chain manipulation: junk and malformed entries collapse into one shared bucket, not fresh ones', async () => {
  const codes = [];
  for (let i = 0; i < 20; i++) codes.push(await lookup({ 'x-forwarded-for': `203.0.113.1, not-an-ip-${i}`, 'x-real-ip': forged(i) }));
  assert.ok(codes.slice(15).every((c) => c === 429), JSON.stringify(codes));
});

test('IPv6: rotating the host part inside one /64 does not reset the limit', async () => {
  const prefix = `2001:db8:${(Math.random() * 65535 | 0).toString(16)}:${(Math.random() * 65535 | 0).toString(16)}`;
  const codes = [];
  for (let i = 0; i < 20; i++) codes.push(await lookup({ 'x-forwarded-for': `${forged(i)}, ${prefix}::${(i + 1).toString(16)}` }));
  assert.ok(codes.slice(15).every((c) => c === 429), JSON.stringify(codes));
});

test('customer login: rotating forged headers does not escape the per-client lockout', async () => {
  const client = freshClient();
  const email = `nobody-${Date.now()}@example.test`;
  const codes = [];
  for (let i = 0; i < 9; i++) codes.push(await post('/api/auth/login', { email, password: `wrong-${i}` }, viaProxy(client, i)));
  assert.ok(codes.slice(5).includes(429), `a lockout must start after 5 failures: ${JSON.stringify(codes)}`);
});

test('customer login: guessing ONE account from many different clients is stopped by the per-account limit', async () => {
  const email = `victim-${Date.now()}@example.test`;
  const reg = await post('/api/auth/register', { name: 'Synthetic Victim', email, password: 'Correct-Horse-Battery-9' }, viaProxy(freshClient(), 1));
  assert.equal(reg, 200);
  const codes = [];
  for (let i = 0; i < 9; i++) codes.push(await post('/api/auth/login', { email, password: `guess-${i}` }, viaProxy(freshClient(), i)));
  assert.ok(codes.slice(5).includes(429), `account must lock after 5 failures even from 9 distinct clients: ${JSON.stringify(codes)}`);
});

test('customer login: a normal user with the right password and a typo or two still gets in', async () => {
  const client = freshClient();
  const email = `normal-${Date.now()}@example.test`;
  assert.equal(await post('/api/auth/register', { name: 'Synthetic Normal', email, password: 'Correct-Horse-Battery-9' }, viaProxy(client, 1)), 200);
  assert.equal(await post('/api/auth/login', { email, password: 'typo-1' }, viaProxy(client, 2)), 401);
  assert.equal(await post('/api/auth/login', { email, password: 'typo-2' }, viaProxy(client, 3)), 401);
  assert.equal(await post('/api/auth/login', { email, password: 'Correct-Horse-Battery-9' }, viaProxy(client, 4)), 200);
});

test('admin login still works for the real owner', { skip: !ADMIN_USER || !ADMIN_PASS }, async () => {
  const client = freshClient();
  assert.equal(await post('/api/admin/login', { username: ADMIN_USER, password: 'wrong-password' }, viaProxy(client, 1)), 401);
  assert.equal(await post('/api/admin/login', { username: ADMIN_USER, password: ADMIN_PASS }, viaProxy(client, 2)), 200);
});

test('admin login: one client\'s repeated failures lock that client even with rotating forged headers', { skip: !ADMIN_USER }, async () => {
  const client = freshClient();
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push(await post('/api/admin/login', { username: ADMIN_USER, password: `wrong-${i}` }, viaProxy(client, i)));
  assert.ok(codes.slice(5).includes(429), JSON.stringify(codes));
});
