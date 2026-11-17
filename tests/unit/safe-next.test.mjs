// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { safeNext } from '../../lib/safe-next.ts';

const ORIGIN = 'https://petalya.example';
const BS = String.fromCharCode(92); // backslash
const c = (n) => String.fromCharCode(n);

/** What a browser will actually navigate to for a Location header / location.href value. */
const lands = (value) => new URL(value, ORIGIN);
const staysHome = (out, fallback = '/account') => {
  assert.equal(lands(out).origin, ORIGIN, `leaves the site: ${JSON.stringify(out)}`);
  assert.ok(out === fallback || (out.startsWith('/') && !out.startsWith('//')), `not a plain absolute path: ${JSON.stringify(out)}`);
};

test('the PT-07 payload and its relatives all fall back', () => {
  const payloads = [
    '/\t/evil.example', '/\r/evil.example', '/\n/evil.example', '/\r\n/evil.example', '/\t\t/evil.example', '/\v/evil.example', '/\f/evil.example',
    '/' + c(0) + '/evil.example', '/' + c(0x7f) + '/evil.example', '/' + c(0x85) + '/evil.example', '/' + c(0x2028) + '/evil.example', '/' + c(0x2029) + '/evil.example',
    '//evil.example', '///evil.example', '////evil.example', '/' + BS + 'evil.example', '/' + BS + '/evil.example', BS + '/evil.example', BS + BS + 'evil.example',
    '/.//evil.example', '/./\/evil.example', '/a/..//evil.example', '/a/../\/evil.example', '/a/b/../..//evil.example', '/..//evil.example', '/../../\/evil.example',
    'https://evil.example', 'http://evil.example', 'javascript:alert(1)', 'data:text/html,x', 'evil.example', '', ' /x', '/x ' + c(9), 'mailto:a@b.co',
  ];
  for (const p of payloads) assert.equal(safeNext(p), '/account', JSON.stringify(p));
});

test('legitimate same-site paths pass and keep their query and fragment', () => {
  for (const ok of ['/checkout', '/checkout?x=1&y=2', '/p/abc123', '/p/abc#reviews', '/account/orders?page=2#top', '/order/AB12', '/account/login?next=%2Fcheckout', '/%E0%A4%A', '/a%20b']) {
    const out = safeNext(ok);
    assert.equal(out, new URL(ok, 'https://x.invalid').pathname + new URL(ok, 'https://x.invalid').search + new URL(ok, 'https://x.invalid').hash, ok);
    staysHome(out);
  }
});

test('encoded slashes and tabs stay inside the site (they are data, not separators)', () => {
  for (const s of ['/%09/evil.example', '/%0d/evil.example', '/%2f/evil.example', '/%2F%2Fevil.example', '/%5cevil.example', '/%5C%5Cevil.example']) {
    const out = safeNext(s);
    staysHome(out);
    assert.ok(!out.includes('\t') && !out.includes('\r') && !out.includes('\n'));
  }
});

test('a custom fallback is honoured', () => {
  assert.equal(safeNext('//evil.example', '/'), '/');
  assert.equal(safeNext(undefined, '/home'), '/home');
  assert.equal(safeNext(null, '/home'), '/home');
  assert.equal(safeNext({}, '/home'), '/home');
  assert.equal(safeNext(['/x'], '/home'), '/home');
  assert.equal(safeNext(5, '/home'), '/home');
});

test('over-long values fall back instead of being cut at an arbitrary point', () => {
  assert.equal(safeNext('/' + 'a'.repeat(200)), '/account');
  assert.equal(safeNext('/' + 'a'.repeat(199)), '/' + 'a'.repeat(199));
});

test('FUZZ: 200,000 random strings built from the dangerous building blocks never leave the site', () => {
  const parts = ['/', '/', '/', BS, '.', '..', './', '../', '\t', '\r', '\n', c(0), c(0x7f), c(0x85), c(0x2028), '%09', '%0d', '%0a', '%2f', '%2F', '%5c', '%5C', '%00', '@', ':', '?', '#', '=', '&', 'evil.example', 'a', 'b', ' ', ' ', '　', '／', '∕', 'http:', 'https:', 'javascript:', '[', ']', '%', '%2e', '%2E', '%252f'];
  let seed = 0x9e3779b9;
  const rnd = () => ((seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x1b873593) | 0) >>> 0) / 2 ** 32;
  let accepted = 0;
  for (let i = 0; i < 200_000; i++) {
    const n = 1 + Math.floor(rnd() * 10);
    let s = rnd() < 0.7 ? '/' : '';
    for (let k = 0; k < n; k++) s += parts[Math.floor(rnd() * parts.length)];
    const out = safeNext(s);
    staysHome(out);
    if (out !== '/account') accepted++;
    // idempotent: feeding a result back in changes nothing
    assert.equal(safeNext(out), out, `not idempotent: ${JSON.stringify(s)} -> ${JSON.stringify(out)}`);
  }
  assert.ok(accepted > 1000, 'the fuzzer must also produce plenty of accepted values (otherwise it proves nothing)');
});

test('source guard: every redirect target in the app goes through safeNext, and customer.ts re-exports the same function', () => {
  const read = (p) => fs.readFileSync(path.resolve(import.meta.dirname, '../..', p), 'utf8');
  assert.match(read('lib/customer.ts'), /export \{ safeNext \} from '\.\/safe-next'/);
  assert.ok(!/function safeNext/.test(read('lib/customer.ts')), 'no second, weaker copy');
  for (const f of ['app/(site)/account/login/page.tsx', 'app/(site)/account/register/page.tsx', 'app/api/auth/google/route.ts', 'app/api/auth/google/callback/route.ts']) assert.match(read(f), /safeNext\(/, f);
});
