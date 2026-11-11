import type { MetadataRoute } from 'next';

/** The customer-facing app ("Add to home screen" on the phone). The owner's dashboard has its own, see admin-manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Petalya — Cakes & Cupcakes',
    short_name: 'Petalya',
    description: 'Cakes أنيقة لأحلى لحظاتك — Elegant custom cakes and handcrafted cupcakes.',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FBF5EE',
    theme_color: '#FBF5EE',
    categories: ['food', 'shopping'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'اطلب دلوقتي', short_name: 'اطلب', url: '/#menu', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'تتبّع طلبك', short_name: 'تتبّع', url: '/track', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
