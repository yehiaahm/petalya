import fs from 'node:fs/promises';
import { readForm, TOO_BIG, tooBig } from '@/lib/body';
import { retentionFromEnv } from '@/lib/retention';
import { maybeSweepUploads, refUploadBytes, sweepUploads } from '@/lib/uploads';
import { LIMITS } from '@/lib/limits';
import path from 'node:path';
import { UPLOAD_DIR } from '@/lib/db';
import { shortId } from '@/lib/crypto';
import { clientIp, rateLimited } from '@/lib/net';

/**
 * Public endpoint for customers' reference photos (checkout).
 * Images only (checked by their bytes), small, and rate-limited per visitor.
 */
const EXT: Record<string, string> = { 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/avif': '.avif' };
const MAX_BYTES = 4 * 1024 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 12;

function sniff(b: Uint8Array) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'image/avif';
  return '';
}

export async function POST(req: Request) {
  if (rateLimited('upload', clientIp(req), MAX_PER_WINDOW, WINDOW_MS)) return Response.json({ error: 'rate' }, { status: 429 });
  const form = await readForm(req, LIMITS.upload);
  if (form === TOO_BIG) return tooBig();
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'no_file' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'too_big' }, { status: 413 });
  const buf = new Uint8Array(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) return Response.json({ error: 'type' }, { status: 415 });
  // Bounded storage (PT-06): clean up abandoned photos now and then, and refuse a new one when the quota is full.
  maybeSweepUploads();
  const quota = retentionFromEnv(process.env).refQuotaBytes;
  if ((await refUploadBytes()) + buf.length > quota) {
    await sweepUploads(24 * 60 * 60 * 1000); // under pressure: anything unused for a day goes
    if ((await refUploadBytes()) + buf.length > quota) return Response.json({ error: 'storage_full' }, { status: 507 });
  }
  const name = `ref-${Date.now().toString(36)}-${shortId(10).toLowerCase()}${EXT[type]}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
  return Response.json({ url: `/uploads/${name}` });
}
