import { jsonForScript } from '@/lib/safe';
import { HomeClient } from '@/components/site/HomeClient';
import { getPublicData } from '@/lib/db';

export default async function Home() {
  const data = await getPublicData();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    name: 'Petalya Cakes',
    image: '/assets/logo.png',
    servesCuisine: 'Cakes & cupcakes',
    areaServed: 'Cairo & Giza',
    sameAs: [data.settings.instagramUrl],
    telephone: '+' + data.settings.whatsapp,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(jsonLd) }} />
      <HomeClient />
    </>
  );
}
