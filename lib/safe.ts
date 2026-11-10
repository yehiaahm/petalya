const BACKSLASH = String.fromCharCode(92);
const LINE_SEP = String.fromCharCode(0x2028);
const PARA_SEP = String.fromCharCode(0x2029);

/** Serialise JSON for an inline <script type="application/ld+json"> without letting data close the tag. */
export function jsonForScript(value: unknown) {
  return JSON.stringify(value)
    .split('<').join(BACKSLASH + 'u003c')
    .split(LINE_SEP).join(BACKSLASH + 'u2028')
    .split(PARA_SEP).join(BACKSLASH + 'u2029');
}

/** A CSV cell that a spreadsheet will not run as a formula (=, +, -, @, tab or CR at the start). */
export function csvCell(v: unknown) {
  let t = String(v ?? '');
  if (typeof v === 'string' && t.length > 0 && ['=', '+', '-', '@', String.fromCharCode(9), String.fromCharCode(13)].includes(t[0])) t = "'" + t;
  return '"' + t.split('"').join('""') + '"';
}
