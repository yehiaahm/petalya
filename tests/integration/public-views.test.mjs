// End-to-end regression tests for PT-07 (open redirect) and PT-14 (public order view and public reviews expose too much).
//
//   BASE_URL=http://127.0.0.1:3111 TEST_ADMIN_USER=... TEST_ADMIN_PASS=... npm run test:integration
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3111';
const ADMIN_USER = process.env.TEST_ADMIN_USER;
const ADMIN_PASS = process.env.TEST_ADMIN_PASS;
const skipAdmin = !ADMIN_USER || !ADMIN_PASS;
const ORIGIN = new URL(BASE).origin;

let n = (Math.floor(Math.random() * 200) + 1) + 2000;
const client = () => `198.51.${(n >> 8) & 255}.${(n++ & 255) || 1}`;
const cookieOf = (r, name) => r.headers.getSetCookie().map((c) => c.split(';')[0]).find((c) => c.startsWith(name + '='));

async function call(method, path, { cookie = '', body, manual = false } = {}) {
  const r = await fetch(BASE + path, { method, redirect: manual ? 'manual' : 'follow', headers: { 'content-type': 'application/json', 'x-forwarded-for': client(), ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json, res: r };
}

/* ---------------- PT-07: open redirect ---------------- */

// as they would arrive in a URL query (already percent-encoded)
const PAYLOADS = ['%2F%09%2Fevil.example', '%2F%0D%2Fevil.example', '%2F%0A%2Fevil.example', '%2F%0D%0A%2Fevil.example', '%2F.%2F%2Fevil.example', '%2Fa%2F..%2F%2Fevil.example', '%2F%5Cevil.example', '%2F%2Fevil.example', 'https%3A%2F%2Fevil.example'];

// The page hands the redirect target to the sign-in form as a prop: \"next\":\"<value>\" inside the page's data.
// (Next itself also echoes the requested URL back in the page data, which is not a redirect target, so look at the prop.)
const nextProp = (html) => html.match(/\\"next\\":\\"(.*?)\\"/)?.[1];

test('PT-07: the sign-in and register pages hand the form a safe redirect target, never the crafted one', async () => {
  for (const page of ['/account/login', '/account/register']) {
    for (const p of PAYLOADS) {
      const r = await call('GET', `${page}?next=${p}`);
      assert.equal(r.status, 200);
      assert.equal(nextProp(r.text), '/account', `${page}?next=${p} handed the form ${JSON.stringify(nextProp(r.text))}`);
    }
  }
});

test('PT-07: a signed-in visitor opening a crafted link is only ever redirected inside the site', async () => {
  const email = `redir-${Date.now()}@example.test`;
  const reg = await call('POST', '/api/auth/register', { body: { name: 'Synthetic Redirect', email, password: 'Correct-Horse-Battery-9' } });
  assert.equal(reg.status, 200);
  const cookie = cookieOf(reg.res, 'petalya_user');
  for (const page of ['/account/login', '/account/register']) {
    for (const p of PAYLOADS) {
      const r = await call('GET', `${page}?next=${p}`, { cookie, manual: true });
      assert.ok([301, 302, 303, 307, 308].includes(r.status), `${page} ${p}: ${r.status}`);
      const loc = r.res.headers.get('location');
      const dest = new URL(loc, ORIGIN);
      assert.equal(dest.origin, ORIGIN, `${page}?next=${p} redirects to ${JSON.stringify(loc)}`);
      assert.ok(!loc.startsWith('//'), loc);
    }
  }
});

/** Where "continue with Google" will send the visitor back to afterwards: from the oauth cookie when Google is set up, else from the redirect. */
function googleNext(r) {
  const set = r.res.headers.getSetCookie().find((c) => c.startsWith('petalya_oauth='));
  if (set) return JSON.parse(decodeURIComponent(set.split(';')[0].slice('petalya_oauth='.length))).next;
  return new URL(r.res.headers.get('location'), ORIGIN).searchParams.get('next');
}

test('PT-07: starting Google sign-in with a crafted next never stores or echoes a foreign target', async () => {
  for (const p of PAYLOADS) {
    const r = await call('GET', `/api/auth/google?next=${p}`, { manual: true });
    const next = googleNext(r);
    assert.equal(new URL(next, ORIGIN).origin, ORIGIN, `stored next ${JSON.stringify(next)}`);
    assert.ok(!next.startsWith('//') && !next.includes('evil.example'), JSON.stringify(next));
    assert.ok(!(r.res.headers.get('location') || '').includes('evil.example'));
  }
});

test('PT-07: legitimate next values still work (signed-in redirect, page prop, Google start)', async () => {
  const email = `redir2-${Date.now()}@example.test`;
  const reg = await call('POST', '/api/auth/register', { body: { name: 'Synthetic Redirect', email, password: 'Correct-Horse-Battery-9' } });
  const cookie = cookieOf(reg.res, 'petalya_user');
  const r = await call('GET', '/account/login?next=%2Fcheckout%3Fx%3D1', { cookie, manual: true });
  assert.equal(new URL(r.res.headers.get('location'), ORIGIN).pathname + new URL(r.res.headers.get('location'), ORIGIN).search, '/checkout?x=1');
  const page = await call('GET', '/account/login?next=%2Fcheckout');
  assert.ok(page.text.includes('/checkout'));
  const g = await call('GET', '/api/auth/google?next=%2Fcheckout', { manual: true });
  assert.equal(googleNext(g), '/checkout');
});

/* ---------------- PT-14: what the public order link and public reviews reveal ---------------- */

const SECRET_STREET = '99 Confidential Street, Building 7, Flat 4';
const SECRET_NOTE = 'CONFIDENTIAL-NOTE-4821';
const FULL_NAME = 'Synthia Surnameton';

async function placeOrder(cookie) {
  const day = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  const r = await call('POST', '/api/orders', {
    cookie,
    body: { lines: [{ kind: 'custom', design: {}, qty: 1 }], customer: { name: FULL_NAME, phone: '01012345678', email: 'synthia@example.test' }, fulfillment: { type: 'delivery', zoneId: 'z-nasr', address: SECRET_STREET, date: day }, payment: 'cod', notes: SECRET_NOTE },
  });
  assert.equal(r.status, 200, r.text);
  return r.json;
}

async function customerCookie() {
  const email = `pub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  const reg = await call('POST', '/api/auth/register', { body: { name: 'Synthetic Owner', email, password: 'Correct-Horse-Battery-9' } });
  assert.equal(reg.status, 200);
  return { cookie: cookieOf(reg.res, 'petalya_user'), id: reg.json.user.id };
}

test('PT-14: anyone holding the order link gets no street address, notes, surname, internal ids or admin fields', async () => {
  const { cookie, id: userId } = await customerCookie();
  const { id } = await placeOrder(cookie); // a signed-in customer's order carries an internal userId
  const api = await call('GET', `/api/orders/${id}`); // no cookie: a stranger with the link
  assert.equal(api.status, 200);
  for (const secret of [SECRET_STREET, 'Confidential', SECRET_NOTE, 'Surnameton', 'synthia@example.test', userId, '01012345678']) assert.ok(!api.text.includes(secret), `API response leaks ${secret}`);
  const o = api.json;
  assert.equal(o.customer.name, 'Synthia', 'first name only');
  assert.match(o.customer.phone, /^010•+678$/);
  assert.equal(o.fulfillment.address, undefined);
  assert.ok(o.fulfillment.zoneName, 'the delivery zone is still shown');
  for (const k of ['notes', 'userId', 'adminNotes', 'seen', 'demo']) assert.ok(!(k in o), `field ${k} must not be public`);
  const page = await call('GET', `/order/${id}`);
  assert.equal(page.status, 200);
  for (const secret of [SECRET_STREET, 'Confidential', SECRET_NOTE, 'Surnameton', userId]) assert.ok(!page.text.includes(secret), `order page leaks ${secret}`);
});

test('PT-14: what the tracking page needs is still there (code, status, items, totals, date, zone)', async () => {
  const { id, code } = await placeOrder('');
  const o = (await call('GET', `/api/orders/${id}`)).json;
  assert.equal(o.code, code);
  assert.equal(o.status, 'new');
  assert.ok(o.items.length === 1 && o.items[0].name && o.total > 0);
  assert.ok(o.fulfillment.date && o.fulfillment.type === 'delivery');
  assert.ok(Array.isArray(o.history) && o.history.length >= 1);
  assert.equal(o.payment.method, 'cod');
});

test('PT-14: order lookup by code + phone still works', async () => {
  const { id, code } = await placeOrder('');
  const r = await call('POST', '/api/orders/lookup', { body: { code, phone: '01012345678' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.id, id);
});

test('PT-14: the account owner and the shop owner still see the full details', { skip: skipAdmin }, async () => {
  const { cookie } = await customerCookie();
  const { id } = await placeOrder(cookie);
  const mine = await call('GET', '/account', { cookie });
  assert.ok(mine.text.includes(SECRET_STREET), 'the signed-in customer sees their own address on their account page');
  const login = await call('POST', '/api/admin/login', { body: { username: ADMIN_USER, password: ADMIN_PASS } });
  assert.equal(login.status, 200);
  const adminCookie = cookieOf(login.res, 'petalya_admin');
  const adminPage = await call('GET', `/admin/orders/${id}`, { cookie: adminCookie });
  assert.ok(adminPage.text.includes(SECRET_STREET) && adminPage.text.includes(SECRET_NOTE), 'the shop owner sees address and notes');
});

test('PT-14: public reviews on the home page never carry the order code', { skip: skipAdmin }, async () => {
  const login = await call('POST', '/api/admin/login', { body: { username: ADMIN_USER, password: ADMIN_PASS } });
  const cookie = cookieOf(login.res, 'petalya_admin');
  const review = { id: 'rv-probe-1', name: { ar: 'سارة', en: 'Sara' }, occasion: { ar: 'عيد ميلاد', en: 'Birthday' }, quote: { ar: 'تورتة حلوة جدا اختبار', en: 'Review probe text ZETA' }, rating: 5, status: 'approved', orderCode: 'PT-98765', createdAt: new Date().toISOString() };
  const put = await call('PUT', '/api/admin/reviews', { cookie, body: [review] });
  assert.equal(put.status, 200);
  assert.ok(put.text.includes('PT-98765'), 'control: the admin API does keep the code for the owner');
  const home = await call('GET', '/');
  assert.ok(home.text.includes('Review probe text ZETA') || home.text.includes('تورتة حلوة جدا اختبار'), 'the approved review is shown');
  assert.ok(!home.text.includes('PT-98765'), 'the order code must not be public');
});
