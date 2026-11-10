/** A separate installable app for the owner: opens straight on the orders and receives the new-order alerts. */
export function GET() {
  const manifest = {
    id: '/admin',
    name: 'Petalya — لوحة التحكم',
    short_name: 'Petalya Admin',
    description: 'إدارة الطلبات والمنتجات',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/admin/orders',
    scope: '/admin',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F7F0E8',
    theme_color: '#4A2C22',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' } });
}
