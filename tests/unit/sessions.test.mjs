// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { addSession, hasSession, removeSession, newSessionId, MAX_SESSIONS } from '../../lib/sessions.ts';

const DAY = 864e5;

test('ids are long, random and unique', () => {
  const ids = new Set(Array.from({ length: 5000 }, newSessionId));
  assert.equal(ids.size, 5000);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{24}$/);
});

test('a session is valid only while it is on the list and unexpired', () => {
  const now = 1_000_000;
  const list = addSession([], 'a'.repeat(24), now, DAY);
  assert.equal(hasSession(list, 'a'.repeat(24), now + 1), true);
  assert.equal(hasSession(list, 'a'.repeat(24), now + DAY), false, 'expired');
  assert.equal(hasSession(list, 'b'.repeat(24), now + 1), false, 'unknown id');
});

test('REVOCATION: after removeSession the same id is no longer valid, and other sessions are untouched', () => {
  const now = 5_000;
  let list = addSession([], 'a'.repeat(24), now, DAY);
  list = addSession(list, 'b'.repeat(24), now, DAY);
  list = removeSession(list, 'a'.repeat(24));
  assert.equal(hasSession(list, 'a'.repeat(24), now + 1), false);
  assert.equal(hasSession(list, 'b'.repeat(24), now + 1), true);
});

test('removing an id that is not there, or from an undefined list, is harmless', () => {
  assert.deepEqual(removeSession(undefined, 'x'), []);
  assert.deepEqual(removeSession([], 'x'), []);
});

test('malformed ids never match, whatever the list holds', () => {
  const list = [{ id: 'short', exp: Infinity, at: 0 }, { id: '', exp: Infinity, at: 0 }, { id: 'z'.repeat(100), exp: Infinity, at: 0 }];
  for (const bad of ['short', '', 'z'.repeat(100), undefined, null, 5, {}, ['a'.repeat(24)]]) assert.equal(hasSession(list, bad, 1), false, String(bad));
  assert.equal(hasSession(undefined, 'a'.repeat(24), 1), false);
});

test('adding prunes expired sessions and keeps only the newest MAX_SESSIONS', () => {
  let list = [];
  let t = 0;
  for (let i = 0; i < MAX_SESSIONS + 10; i++) list = addSession(list, String(i).padStart(24, '0'), (t += 10), DAY);
  assert.equal(list.length, MAX_SESSIONS);
  assert.equal(list[0].id, String(10).padStart(24, '0'), 'oldest dropped first');
  const later = addSession(list, 'n'.repeat(24), t + 2 * DAY, DAY);
  assert.deepEqual(later.map((s) => s.id), ['n'.repeat(24)], 'everything expired is pruned');
});

test('source guard: no code path accepts a session without checking the server-side list', () => {
  const read = (p) => fs.readFileSync(path.resolve(import.meta.dirname, '../..', p), 'utf8');
  const auth = read('lib/auth.ts');
  const customer = read('lib/customer.ts');
  assert.match(auth, /hasSession\(db\.admin\.sessions, c\.sid/);
  assert.match(customer, /hasSession\(u\.sessions, c\.sid/);
  // logout must hit the server, not just delete the cookie
  assert.match(read('app/api/admin/logout/route.ts'), /endAdminSession/);
  assert.match(read('app/api/auth/logout/route.ts'), /endUserSession/);
  assert.ok(!/clearSessionCookie\(\)|clearUserSession\(\)/.test(read('app/api/admin/logout/route.ts') + read('app/api/auth/logout/route.ts')), 'logout routes must not just clear the cookie');
});

test('source guard: every flow that changes or drops a credential also revokes sessions', () => {
  const read = (p) => fs.readFileSync(path.resolve(import.meta.dirname, '../..', p), 'utf8');
  assert.match(read('app/api/admin/password/route.ts'), /d\.admin\.sessions = \[\]/);
  assert.match(read('app/api/account/password/route.ts'), /u\.sessions = \[\]/);
  assert.match(read('app/api/admin/users/[id]/route.ts'), /u\.sessions = \[\]/);
  assert.match(read('app/api/auth/google/callback/route.ts'), /u\.sessions = \[\]/);
});

test('source guard: session records are never exported or sent to the browser', () => {
  const read = (p) => fs.readFileSync(path.resolve(import.meta.dirname, '../..', p), 'utf8');
  assert.match(read('app/api/admin/export/route.ts'), /sessions: _s/);
  assert.ok(!/sessions/.test(read('lib/customer.ts').split('export function publicUser')[1] ?? ''), 'publicUser must not expose sessions');
});
