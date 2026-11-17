// Run: npm test        (Node >= 22.18 runs the .ts import directly)
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientIp, proxyConfigFromEnv, normalizeIp, UNKNOWN_IP } from '../../lib/client-ip.ts';

const h = (o) => ({ get: (k) => o[k.toLowerCase()] ?? null });
const ONE = { hops: 1, header: null };
const TWO = { hops: 2, header: null };

test('x-real-ip is ignored by default, however it is rotated (PT-02 core)', () => {
  const real = '203.0.113.7';
  const seen = new Set();
  for (let i = 0; i < 50; i++) seen.add(resolveClientIp(h({ 'x-real-ip': `10.0.${i}.1`, 'x-forwarded-for': real }), ONE));
  assert.deepEqual([...seen], [real]);
});

test('client-prepended x-forwarded-for entries cannot change the key', () => {
  const real = '203.0.113.7';
  const seen = new Set();
  for (let i = 0; i < 50; i++) seen.add(resolveClientIp(h({ 'x-forwarded-for': `9.9.9.${i}, 8.8.${i}.8, ${real}` }), ONE));
  assert.deepEqual([...seen], [real]);
});

test('a very long forged chain is handled and still picks the proxy-appended entry', () => {
  const chain = Array.from({ length: 500 }, (_, i) => `1.1.${i % 256}.${(i * 7) % 256}`).join(', ');
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': `${chain}, 203.0.113.9` }), ONE), '203.0.113.9');
});

test('multiple x-forwarded-for header lines (joined by the runtime) still use the last entry', () => {
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7, 203.0.113.5' }), ONE), '203.0.113.5');
});

test('two trusted hops (CDN + platform) pick the client the CDN saw, not the CDN or the forged prefix', () => {
  // client-forged, real client (appended by CDN), CDN address (appended by platform)
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': '6.6.6.6, 198.51.100.20, 104.16.0.1' }), TWO), '198.51.100.20');
});

test('chain shorter than the trusted hop count falls back to the shared bucket', () => {
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': '203.0.113.7' }), TWO), UNKNOWN_IP);
});

test('hops=0 believes no header at all', () => {
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '203.0.113.7' }), { hops: 0, header: null }), UNKNOWN_IP);
});

test('missing header, empty header and empty trailing entry fail closed', () => {
  assert.equal(resolveClientIp(h({}), ONE), UNKNOWN_IP);
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': '' }), ONE), UNKNOWN_IP);
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': '203.0.113.7, ' }), ONE), UNKNOWN_IP);
});

test('empty entries are not skipped, so they cannot shift which entry is chosen', () => {
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': ',,,,203.0.113.7' }), ONE), '203.0.113.7');
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': '203.0.113.7,,' }), TWO), UNKNOWN_IP);
});

test('junk, script, oversized and non-IP values are rejected, never used as a key', () => {
  for (const bad of ['<script>alert(1)</script>', 'unknown', 'localhost', '999.1.1.1', '1.2.3', '1.2.3.4.5', 'a'.repeat(500), '1.2.3.4 evil', '0x7f.0.0.1', '1e3.0.0.1', "1.2.3.4'--", '::g', ':::', '1:2:3:4:5:6:7:8:9']) {
    assert.equal(resolveClientIp(h({ 'x-forwarded-for': `203.0.113.1, ${bad}` }), ONE), UNKNOWN_IP, JSON.stringify(bad));
  }
});

test('ports and brackets are stripped, leading zeros are normalised', () => {
  assert.equal(normalizeIp('203.0.113.7:51234'), '203.0.113.7');
  assert.equal(normalizeIp('[2001:db8:1:2::9]:443'), '2001:db8:1:2::/64');
  assert.equal(normalizeIp('203.000.113.007'), null); // octal-looking forms are not accepted
  assert.equal(normalizeIp('  203.0.113.7  '), '203.0.113.7');
});

test('IPv6: rotating the host part inside one /64 gives ONE key', () => {
  const keys = new Set();
  for (let i = 0; i < 200; i++) keys.add(resolveClientIp(h({ 'x-forwarded-for': `2001:db8:abcd:12::${i.toString(16)}` }), ONE));
  for (const a of ['2001:db8:abcd:12:1:2:3:4', '2001:DB8:ABCD:12:ffff:ffff:ffff:ffff', '2001:db8:abcd:12::']) keys.add(resolveClientIp(h({ 'x-forwarded-for': a }), ONE));
  assert.deepEqual([...keys], ['2001:db8:abcd:12::/64']);
});

test('IPv6: different /64s stay different, IPv4-mapped IPv6 equals the IPv4 client', () => {
  const a = resolveClientIp(h({ 'x-forwarded-for': '2001:db8:abcd:12::1' }), ONE);
  const b = resolveClientIp(h({ 'x-forwarded-for': '2001:db8:abcd:13::1' }), ONE);
  assert.notEqual(a, b);
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': '::ffff:203.0.113.7' }), ONE), '203.0.113.7');
});

test('IPv6 compression forms parse to the same /64', () => {
  const forms = ['2001:db8:0:0:0:0:0:1', '2001:db8::1', '2001:0db8:0000::0001'];
  const keys = new Set(forms.map((f) => normalizeIp(f)));
  assert.equal(keys.size, 1);
});

test('different real clients do not share a key (existing per-client limiting is preserved)', () => {
  const a = resolveClientIp(h({ 'x-forwarded-for': '203.0.113.1' }), ONE);
  const b = resolveClientIp(h({ 'x-forwarded-for': '203.0.113.2' }), ONE);
  assert.notEqual(a, b);
});

test('TRUSTED_IP_HEADER: only the named header is used, and x-forwarded-for is then ignored', () => {
  const cfg = { hops: 1, header: 'x-real-ip' };
  assert.equal(resolveClientIp(h({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '6.6.6.6' }), cfg), '203.0.113.7');
  assert.equal(resolveClientIp(h({ 'x-forwarded-for': '203.0.113.7' }), cfg), UNKNOWN_IP);
  assert.equal(resolveClientIp(h({ 'x-real-ip': '1.1.1.1, 2.2.2.2' }), cfg), UNKNOWN_IP); // a list is not a single trusted value
});

test('config: defaults are safe, bad values fall back, x-forwarded-for cannot be named as the header', () => {
  assert.deepEqual(proxyConfigFromEnv({ NODE_ENV: 'production' }), { hops: 1, header: null });
  assert.deepEqual(proxyConfigFromEnv({ NODE_ENV: 'development' }), { hops: 0, header: null });
  assert.deepEqual(proxyConfigFromEnv({}), { hops: 0, header: null });
  assert.equal(proxyConfigFromEnv({ NODE_ENV: 'production', TRUSTED_PROXY_HOPS: '2' }).hops, 2);
  assert.equal(proxyConfigFromEnv({ NODE_ENV: 'production', TRUSTED_PROXY_HOPS: '0' }).hops, 0);
  for (const bad of ['-1', 'abc', '99', '1.5', '', ' ', '1; DROP']) assert.equal(proxyConfigFromEnv({ NODE_ENV: 'production', TRUSTED_PROXY_HOPS: bad }).hops, 1, bad);
  assert.equal(proxyConfigFromEnv({ TRUSTED_IP_HEADER: 'X-Real-IP' }).header, 'x-real-ip');
  assert.equal(proxyConfigFromEnv({ TRUSTED_IP_HEADER: 'x-forwarded-for' }).header, null);
  assert.equal(proxyConfigFromEnv({ TRUSTED_IP_HEADER: 'bad header!' }).header, null);
});
