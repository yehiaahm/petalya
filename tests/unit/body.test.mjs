// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readBytes, readJson, readForm, TOO_BIG } from '../../lib/body.ts';
import { LIMITS, limitForPath, MB } from '../../lib/limits.ts';

const enc = new TextEncoder();

/** A request whose body is a stream we control, with NO content-length (like a chunked upload). */
function streamed(chunks, headers = {}) {
  let i = 0;
  const state = { pulled: 0, cancelled: false };
  const body = new ReadableStream({
    pull(c) {
      const next = typeof chunks === 'function' ? chunks(i++) : chunks[i++];
      if (next === undefined) return c.close();
      state.pulled += next.byteLength;
      c.enqueue(next);
    },
    cancel() {
      state.cancelled = true;
    },
  });
  const req = new Request('http://x.test/api/x', { method: 'POST', body, duplex: 'half', headers });
  return { req, state };
}

test('a body under the ceiling is returned intact, chunk boundaries do not matter', async () => {
  const { req } = streamed([enc.encode('{"a":'), enc.encode('1,"b"'), enc.encode(':"x"}')]);
  assert.deepEqual(await readJson(req, 100), { a: 1, b: 'x' });
});

test('exactly `max` bytes is accepted, max+1 is TOO_BIG', async () => {
  assert.equal((await readBytes(streamed([new Uint8Array(100)]).req, 100)).byteLength, 100);
  assert.equal(await readBytes(streamed([new Uint8Array(101)]).req, 100), TOO_BIG);
});

test('PT-04 core: an endless chunked body with no Content-Length is cut off at the ceiling and the stream is cancelled', async () => {
  const { req, state } = streamed(() => new Uint8Array(64 * 1024)); // never ends
  assert.equal(req.headers.get('content-length'), null);
  const out = await readBytes(req, LIMITS.small);
  assert.equal(out, TOO_BIG);
  assert.equal(state.cancelled, true, 'the source must be cancelled');
  assert.ok(state.pulled <= LIMITS.small + 3 * 64 * 1024, `read ${state.pulled} bytes; must stop right after the ceiling`);
});

test('a lying Content-Length (small) cannot raise the ceiling: bytes are counted, not trusted', async () => {
  const { req, state } = streamed(() => new Uint8Array(64 * 1024), { 'content-length': '10' });
  assert.equal(await readBytes(req, LIMITS.small), TOO_BIG);
  assert.ok(state.pulled <= LIMITS.small + 3 * 64 * 1024);
});

test('an honest oversized Content-Length is refused without reading any of the body', async () => {
  const { req, state } = streamed(() => new Uint8Array(1024), { 'content-length': String(10 * MB) });
  assert.equal(await readBytes(req, LIMITS.small), TOO_BIG);
  assert.equal(state.pulled, 0);
});

test('readJson: empty, malformed and non-UTF8 bodies give null (same as the old .catch(() => null)); valid JSON null stays null', async () => {
  assert.equal(await readJson(streamed([]).req, 100), null);
  assert.equal(await readJson(streamed([enc.encode('{not json')]).req, 100), null);
  assert.equal(await readJson(streamed([new Uint8Array([0xff, 0xfe, 0xfd])]).req, 100), null);
  assert.equal(await readJson(streamed([enc.encode('null')]).req, 100), null);
});

test('readJson: arrays and scalars pass through unchanged', async () => {
  assert.deepEqual(await readJson(streamed([enc.encode('[1,2]')]).req, 100), [1, 2]);
  assert.equal(await readJson(streamed([enc.encode('"s"')]).req, 100), 's');
});

test('readJson: a request with no body at all gives null', async () => {
  assert.equal(await readJson(new Request('http://x.test/', { method: 'POST' }), 100), null);
});

test('readForm: parses a real multipart body, rejects oversize, returns null for garbage', async () => {
  const fd = new FormData();
  fd.set('file', new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }), 'a.png');
  const ok = new Request('http://x.test/', { method: 'POST', body: fd });
  const form = await readForm(ok, 10_000);
  assert.ok(form instanceof FormData);
  assert.equal(form.get('file').size, 4);

  const big = new FormData();
  big.set('file', new Blob([new Uint8Array(50_000)]), 'b.png');
  assert.equal(await readForm(new Request('http://x.test/', { method: 'POST', body: big }), 10_000), TOO_BIG);

  const junk = streamed([enc.encode('not multipart')], { 'content-type': 'multipart/form-data; boundary=zz' });
  assert.equal(await readForm(junk.req, 1000), null);
});

test('ceilings: public routes are small, orders/track medium, admin editors 2 MB, uploads match their file caps', () => {
  assert.equal(limitForPath('/api/auth/login'), LIMITS.small);
  assert.equal(limitForPath('/api/coupons'), LIMITS.small);
  assert.equal(limitForPath('/api/orders'), LIMITS.json);
  assert.equal(limitForPath('/api/track'), LIMITS.json);
  assert.equal(limitForPath('/api/upload'), LIMITS.upload);
  assert.equal(limitForPath('/api/admin/upload'), LIMITS.adminUpload);
  assert.equal(limitForPath('/api/admin/settings'), LIMITS.adminJson);
  assert.ok(LIMITS.upload > 4 * MB && LIMITS.adminUpload > 10 * MB, 'room for the file cap plus the multipart envelope');
  assert.ok(LIMITS.small < LIMITS.json && LIMITS.json < LIMITS.adminJson);
});

test('source guard: no API route reads a body without the size cap', () => {
  const root = path.resolve(import.meta.dirname, '../../app');
  const bad = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'route.ts') {
        const src = fs.readFileSync(p, 'utf8');
        if (/\breq(uest)?\.(json|text|formData|arrayBuffer|blob)\s*\(/.test(src) || /\breq(uest)?\.body\b/.test(src)) bad.push(path.relative(root, p));
      }
    }
  };
  walk(root);
  assert.deepEqual(bad, [], 'use readJson/readForm/readBytes from lib/body.ts instead');
});
