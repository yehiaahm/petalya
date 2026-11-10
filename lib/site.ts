/** Public address of the site (no trailing slash). Works on Railway without any extra setup. */
export function siteUrl() {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;
  return 'http://localhost:3000';
}
