import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Cormorant_Garamond, El_Messiri, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { siteUrl } from '@/lib/site';
import { PwaBoot } from '@/components/pwa/PwaBoot';

const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--f-cormorant', display: 'swap' });
const messiri = El_Messiri({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700'], variable: '--f-messiri', display: 'swap' });
const plex = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['300', '400', '500', '600', '700'], variable: '--f-plex', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'Petalya — Cakes & Cupcakes', template: '%s · Petalya' },
  description: 'تورت أنيقة للحظات لا تُنسى — تورت مخصوصة وكب كيك معمول باليد، طازة وبكل حب. Elegant custom cakes and handcrafted cupcakes in Cairo.',
  applicationName: 'Petalya',
  appleWebApp: { capable: true, title: 'Petalya', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  openGraph: { title: 'Petalya — Cakes & Cupcakes', description: 'Elegant cakes for unforgettable moments', images: ['/assets/logo.png'] },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#FBF5EE' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = (await cookies()).get('petalya.lang')?.value === 'en' ? 'en' : 'ar';
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className={`${cormorant.variable} ${messiri.variable} ${plex.variable}`} suppressHydrationWarning>
      <body>
        {children}
        <PwaBoot />
      </body>
    </html>
  );
}
