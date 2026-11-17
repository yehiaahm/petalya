/**
 * Size-capped request-body readers (PT-04).
 *
 * `await req.json()` / `req.formData()` buffer the WHOLE body before any size check can run, and a body
 * sent with `Transfer-Encoding: chunked` has no Content-Length for proxy.ts to check. These helpers read
 * the stream chunk by chunk, count the bytes, and stop (cancelling the stream) the moment the ceiling is
 * passed, so memory use is bounded by `max` no matter how the client frames the request.
 *
 * Pure (no imports) so it is unit-tested directly: tests/unit/body.test.mjs.
 */

/** Returned instead of the body when it is larger than allowed. */
export const TOO_BIG = Symbol('too_big');

export const tooBig = () => Response.json({ error: 'too_big' }, { status: 413 });

/** Raw bytes, or TOO_BIG. Never buffers more than `max` bytes plus one chunk. */
export async function readBytes(req: Request, max: number): Promise<Uint8Array | typeof TOO_BIG> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) {
    await req.body?.cancel().catch(() => {});
    return TOO_BIG;
  }
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    let step: ReadableStreamReadResult<Uint8Array>;
    try {
      step = await reader.read();
    } catch {
      break; // client went away mid-body: treat what we have as the (invalid) body
    }
    if (step.done) break;
    total += step.value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return TOO_BIG;
    }
    chunks.push(step.value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** Parsed JSON; `null` when the body is empty or not valid JSON (same as the old `.catch(() => null)`); or TOO_BIG. */
export async function readJson(req: Request, max: number): Promise<unknown | typeof TOO_BIG> {
  const bytes = await readBytes(req, max);
  if (bytes === TOO_BIG) return TOO_BIG;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Parsed multipart/form-data; `null` when it is malformed; or TOO_BIG. */
export async function readForm(req: Request, max: number): Promise<FormData | null | typeof TOO_BIG> {
  const bytes = await readBytes(req, max);
  if (bytes === TOO_BIG) return TOO_BIG;
  try {
    return await new Response(bytes as BodyInit, { headers: { 'content-type': req.headers.get('content-type') ?? '' } }).formData();
  } catch {
    return null;
  }
}
