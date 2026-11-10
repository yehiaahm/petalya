// Regenerates the PWA icons in public/icons from public/assets/logo.png.
//   node scripts/gen-icons.mjs
// The logo is a round badge on a dark square, so everything is cut to the circle first.
import sharp from 'sharp';

const src = 'public/assets/logo.png';
const cream = { r: 251, g: 245, b: 238, alpha: 1 };

/** The logo cut to a circle, `size` px wide, transparent outside. */
async function round(size) {
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
  return sharp(src).resize(size, size).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}
const onCream = async (size, inner) =>
  sharp({ create: { width: size, height: size, channels: 4, background: cream } })
    .composite([{ input: await round(inner), gravity: 'center' }])
    .png();

// "any": round logo, transparent corners.
for (const s of [192, 512]) await sharp(await round(s)).toFile(`public/icons/icon-${s}.png`);
// Maskable: Android may crop to any shape, so keep the logo inside the safe circle (80%) on cream.
for (const s of [192, 512]) await (await onCream(s, Math.round(s * 0.8))).toFile(`public/icons/maskable-${s}.png`);
// iOS: opaque square, iOS rounds the corners itself.
await (await onCream(180, 164)).toFile('public/icons/apple-touch-icon.png');

// Notification badge: Android wants a white silhouette on transparent. Keep the logo's dark strokes.
const { data, info } = await sharp(await round(96)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < data.length; i += 4) {
  const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const a = data[i + 3];
  data[i] = data[i + 1] = data[i + 2] = 255;
  data[i + 3] = Math.round((a * Math.max(0, Math.min(255, (225 - lum) * 2.5))) / 255);
}
await sharp(data, { raw: info }).png().toFile('public/icons/badge-96.png');
console.log('icons written');
