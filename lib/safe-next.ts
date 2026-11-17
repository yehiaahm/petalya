/**
 * Safe post-login redirect target (PT-07). Pure, no imports, unit- and fuzz-tested (tests/unit/safe-next.test.mjs).
 *
 * The old check rejected "//" and "/\" but let "/" + TAB/CR/LF + "/evil.example" through. Browsers (and the WHATWG URL
 * parser) delete tabs and newlines from a URL, so that value is read as "//evil.example": a link on our own domain
 * that sends the visitor to another site after they sign in.
 *
 * Rules, all of which must hold for the VALUE THE BROWSER WILL END UP USING (after URL normalisation), not just for
 * the raw string:
 *  - at most 200 characters, no control characters, no backslash;
 *  - starts with a single "/" (never "//", also after "." / ".." segments are resolved: "/.//host" becomes "//host");
 *  - resolves to our own origin.
 * Anything else becomes `fallback`. A good value is returned in its normalised form (path + query + fragment).
 */
// control characters (incl. TAB/CR/LF, which URL parsers delete), line/paragraph separators, backslash
const BAD_CHARS = /[\x00-\x1f\x7f-\x9f\u2028\u2029\\]/;
export function safeNext(n: unknown, fallback = '/account'): string {
  const s = typeof n === 'string' ? n : '';
  if (!s || s.length > 200) return fallback;
  if (BAD_CHARS.test(s)) return fallback;
  if (!s.startsWith('/') || s.startsWith('//')) return fallback;
  try {
    const base = 'https://same-origin.invalid';
    const u = new URL(s, base);
    if (u.origin !== base) return fallback;
    const out = u.pathname + u.search + u.hash;
    // Normalising may have produced a protocol-relative path ("/.//evil.example" -> "//evil.example").
    if (!out.startsWith('/') || out.startsWith('//') || out.length > 200) return fallback;
    return out;
  } catch {
    return fallback;
  }
}
