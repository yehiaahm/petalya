// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createFailureCeiling } from '../../lib/admin-throttle.ts';

const clock = (start = 1_000_000) => {
  let t = start;
  return { now: () => t, tick: (ms) => (t += ms) };
};
const make = (over = {}) => {
  const c = clock();
  return { c, ceiling: createFailureCeiling({ limit: 5, windowMs: 10_000, alertCooldownMs: 60_000, now: c.now, ...over }) };
};

test('nothing is blocked until `limit` failures have happened', () => {
  const { ceiling } = make();
  for (let i = 0; i < 4; i++) {
    assert.equal(ceiling.blocked(), false);
    ceiling.failure();
  }
  assert.equal(ceiling.blocked(), false);
  ceiling.failure();
  assert.equal(ceiling.blocked(), true);
});

test('blocked() is a pure read: asking never uses up budget, so a correct login cannot cause or extend a block', () => {
  const { ceiling } = make();
  for (let i = 0; i < 1000; i++) ceiling.blocked();
  assert.equal(ceiling.count(), 0);
  assert.equal(ceiling.blocked(), false);
});

test('the block lifts once the failures age out of the window', () => {
  const { c, ceiling } = make();
  for (let i = 0; i < 5; i++) ceiling.failure();
  assert.equal(ceiling.blocked(), true);
  c.tick(9_999);
  assert.equal(ceiling.blocked(), true);
  c.tick(2);
  assert.equal(ceiling.blocked(), false);
  assert.equal(ceiling.count(), 0);
});

test('failures spread over time never accumulate into a block', () => {
  const { c, ceiling } = make();
  for (let i = 0; i < 100; i++) {
    ceiling.failure();
    c.tick(3_000); // 3.3 per window < limit 5
  }
  assert.equal(ceiling.blocked(), false);
});

test('only a continued attack keeps the block up: it needs `limit` fresh failures per window', () => {
  const { c, ceiling } = make();
  for (let i = 0; i < 5; i++) ceiling.failure();
  c.tick(10_001);
  assert.equal(ceiling.blocked(), false, 'an attacker that stops no longer blocks anyone');
});

test('the owner alert fires once when the ceiling is reached, not on every later failure, and again after the cooldown', () => {
  const { c, ceiling } = make();
  const fired = [];
  for (let i = 0; i < 12; i++) fired.push(ceiling.failure());
  assert.deepEqual(fired.map(Number), [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
  c.tick(61_000); // cooldown over, and the old failures have aged out of the window
  assert.equal(ceiling.count(), 0);
  const again = [];
  for (let i = 0; i < 6; i++) again.push(ceiling.failure());
  assert.deepEqual(again.map(Number), [0, 0, 0, 0, 1, 0], 'alerts again when the ceiling is reached anew');
});

test('memory stays bounded when failures keep being reported', () => {
  const { ceiling } = make({ windowMs: 1e12 });
  for (let i = 0; i < 100_000; i++) ceiling.failure();
  assert.ok(ceiling.count() <= 10, `kept ${ceiling.count()} entries`);
  assert.equal(ceiling.blocked(), true);
});

test('source guard: the old "count every attempt, block everyone" limiter is gone from both admin sign-in routes', () => {
  const root = path.resolve(import.meta.dirname, '../../app/api');
  for (const rel of ['admin/login/route.ts', 'auth/login/route.ts']) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(!/admin-login-all/.test(src), `${rel} still uses the global all-attempts bucket`);
    assert.ok(/adminLoginBlocked/.test(src) && /adminLoginFailed/.test(src), `${rel} must use the shared admin throttle`);
  }
});

test('source guard: the customer form never applies a per-account lock to the admin name', () => {
  const src = fs.readFileSync(path.resolve(import.meta.dirname, '../../app/api/auth/login/route.ts'), 'utf8');
  assert.match(src, /!adminName && loginBlocked\(acct\)/);
  assert.match(src, /!adminName\) loginFailed\(acct\)/);
});
