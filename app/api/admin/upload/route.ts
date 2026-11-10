import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOAD_DIR } from '@/lib/db';
import { isAdmin, unauthorized } from '@/lib/auth';
import { shortId } from '@/lib/crypto';

const EXT: Record<string, string> = { 'image/webp': '.webp', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/avif': '.avif' };

/** Trust the bytes, not the browser-supplied type. */
function sniff(b: Uint8Array) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'image/avif';
  return '';
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'no_file' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: 'too_big' }, { status: 413 });
  const buf = new Uint8Array(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) return Response.json({ error: 'type' }, { status: 415 });
  const name = `${Date.now().toString(36)}-${shortId(6).toLowerCase()}${EXT[type]}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
  return Response.json({ url: `/uploads/${name}` });
}
