// End-to-end regression tests for PT-03 (a stranger could lock the owner out of the admin sign-in).
//
// IMPORTANT: this file deliberately trips the global failure ceiling and leaves it tripped for 10 minutes, and it
// is named zz-… so it runs last. Run the integration suite against a freshly started server, serially (the npm
// script does this), and restart the server before running it again.
//
//   BASE_URL=http://127.0.0.1:3111 TEST_ADMIN_USER=... TEST_ADMIN_PASS=... npm run test:integration
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3111';
const USER = process.env.TEST_ADMIN_USER;
const PASS = process.env.TEST_ADMIN_PASS;
const skip = !USER || !PASS;

let n = (Math.floor(Math.random() * 200) + 1) + 800;
const freshClient = () => `198.51.${(n >> 8) & 255}.${(n++ & 255) || 1}`;

async function adminLogin(client, password, cookie = '') {
  const r = await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': client, ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ username: USER, password }) });
  await r.arrayBuffer().catch(() => {});
  return r;
}
async function sideDoor(client, email, password) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': client }, body: JSON.stringify({ email, password }) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const cookieOf = (r, name) => r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith(name + '='));

let deviceCookie = '';
let sessionCookie = '';

test('customer-form side door: wrong tries with the admin name from OTHER clients do not lock the real owner out', { skip }, async () => {
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await sideDoor(freshClient(), USER, `wrong-${i}`)).status);
  assert.ok(codes.every((c) => c === 401), JSON.stringify(codes));
  const ok = await sideDoor(freshClient(), USER, PASS);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.admin, true);
});

test('the owner signs in and the browser receives a trusted-device cookie', { skip }, async () => {
  const r = await adminLogin(freshClient(), PASS);
  assert.equal(r.status, 200);
  assert.ok(cookieOf(r, 'petalya_admin'), 'session cookie');
  sessionCookie = cookieOf(r, 'petalya_admin');
  deviceCookie = cookieOf(r, 'petalya_admin_device');
  assert.ok(deviceCookie, 'a trusted-device cookie must be issued on a successful admin sign-in');
  const set = r.headers.getSetCookie().find((c) => c.startsWith('petalya_admin_device='));
  assert.match(set, /HttpOnly/i);
  assert.match(set, /SameSite=lax/i);
});

test('guessing stays bounded: 80 wrong passwords from 80 different clients get at most ~60 real tries, then 429', { skip }, async () => {
  const codes = [];
  for (let i = 0; i < 80; i += 8) {
    const batch = await Promise.all(Array.from({ length: 8 }, (_, k) => adminLogin(freshClient(), `guess-${i + k}`).then((r) => r.status)));
    codes.push(...batch);
  }
  const tried = codes.filter((c) => c === 401).length;
  assert.ok(tried <= 70, `too many real guesses allowed: ${tried}`);
  assert.ok(codes.filter((c) => c === 429).length >= 8, `ceiling did not engage: ${JSON.stringify(codes)}`);
});

test('PT-03 core: while that attack is going on, the owner\'s trusted browser can still sign in, from any address', { skip }, async () => {
  assert.ok(deviceCookie);
  const r = await adminLogin(freshClient(), PASS, deviceCookie);
  assert.equal(r.status, 200);
  assert.ok(cookieOf(r, 'petalya_admin'));
});

test('during the attack, a typo from the trusted browser is a normal 401 (not a lockout), and the right password then works', { skip }, async () => {
  const client = freshClient();
  assert.equal((await adminLogin(client, 'typo', deviceCookie)).status, 401);
  assert.equal((await adminLogin(client, PASS, deviceCookie)).status, 200);
});

test('known residual: during the attack an unrecognised browser waits, even with the right password', { skip }, async () => {
  const r = await adminLogin(freshClient(), PASS);
  assert.equal(r.status, 429);
});

test('a forged or malformed trusted-device cookie gives no bypass', { skip }, async () => {
  for (const bad of ['petalya_admin_device=garbage', 'petalya_admin_device=a.b', `petalya_admin_device=${'A'.repeat(40)}.${'B'.repeat(43)}`, 'petalya_admin_device=']) {
    const r = await adminLogin(freshClient(), PASS, bad);
    assert.equal(r.status, 429, bad);
  }
});

test('the trusted cookie is not a licence to guess: one client still gets locked after 5 wrong tries', { skip }, async () => {
  const client = freshClient();
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await adminLogin(client, `wrong-${i}`, deviceCookie)).status);
  assert.ok(codes.slice(5).includes(429), JSON.stringify(codes));
});

test('changing the password revokes every trusted device (the old cookie stops bypassing), and the new one works; password is restored afterwards', { skip }, async () => {
  assert.ok(deviceCookie && sessionCookie);
  const TMP = 'Temp-Audit-Pass-2026-zz';
  const change = async (cookie, current, next) => {
    const r = await fetch(BASE + '/api/admin/password', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': freshClient(), cookie }, body: JSON.stringify({ current, next }) });
    await r.arrayBuffer().catch(() => {});
    return r;
  };
  const r1 = await change(sessionCookie, PASS, TMP);
  assert.equal(r1.status, 200);
  const newDevice = cookieOf(r1, 'petalya_admin_device');
  const newSession = cookieOf(r1, 'petalya_admin');
  assert.ok(newDevice && newSession, 'password change re-issues session and trusted-device cookies');

  // ceiling is still tripped from the attack above: the OLD trusted device must no longer get through
  assert.equal((await adminLogin(freshClient(), TMP, deviceCookie)).status, 429, 'old trusted device must be revoked');
  const ok = await adminLogin(freshClient(), TMP, newDevice);
  assert.equal(ok.status, 200, 'new trusted device works with the new password');

  // restore the original password
  const r2 = await change(cookieOf(ok, 'petalya_admin'), TMP, PASS);
  assert.equal(r2.status, 200);
  assert.equal((await adminLogin(freshClient(), PASS, cookieOf(r2, 'petalya_admin_device'))).status, 200);
});
