import { jsonForScript } from '@/lib/safe';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicData } from '@/lib/db';
import { ProductPage } from '@/components/site/ProductPage';

// Public product pages read the cached public view (active products + settings), not the whole database.
async function find(id: string) {
  const db = await getPublicData();
  const p = db.products.find((x) => x.id === id);
  return { db, p };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { p } = await find(id);
  if (!p) return { title: 'Not found', robots: { index: false } };
  const title = `${p.name.ar} · ${p.name.en}`;
  const description = `${p.desc.ar} — ${p.desc.en}`;
  return {
    title,
    description,
    alternates: { canonical: `/p/${p.id}` },
    openGraph: { title, description, type: 'website', images: p.images[0] ? [p.images[0]] : ['/assets/logo.png'] },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, p } = await find(id);
  if (!p) notFound();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name.en,
    alternateName: p.name.ar,
    description: p.desc.en,
    image: p.images,
    brand: { '@type': 'Brand', name: 'Petalya' },
    ...(db.settings.showPrices ? { offers: { '@type': 'Offer', priceCurrency: 'EGP', price: p.price, availability: p.soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock' } } : {}),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonForScript(jsonLd) }} />
      <ProductPage id={p.id} />
    </>
  );
}
