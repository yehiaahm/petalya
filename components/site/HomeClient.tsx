'use client';

import { useEffect, useRef, useState } from 'react';
import { useSite } from './SiteProvider';
import { CartBar, Fab, Header, scrollToId } from './Chrome';
import { Hero, Marquee } from './Hero';
import { Gallery } from './Gallery';
import { Menu } from './Menu';
import { Flowers } from './Flowers';
import { CakeBuilder } from './CakeBuilder';
import { Reviews } from './Reviews';
import { ReviewShots } from './ReviewShots';
import { Contact } from './Contact';
import { setupReveal, startLoops } from '@/lib/petals';

export function HomeClient() {
  const { data, lang, pick } = useSite();
  const rootRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(0);

  const photos = data.gallery.map((g) => g.image).filter(Boolean);
  const productPhotos = data.products.flatMap((p) => p.images.slice(0, 1));
  const pool = [...photos, ...productPhotos];
  const heroImgs: [string, string] = [pool[0] || '/assets/cake-birthday.png', photos[2] || pool[1] || '/assets/cupcake-bouquet.png'];

  const cats = data.categories.filter((c) => data.products.some((p) => p.categoryId === c.id));
  const bouquetIdx = Math.max(0, cats.findIndex((c) => /bouquet/i.test(c.id + c.name.en)));

  useEffect(() => {
    const root = rootRef.current!;
    const off = setupReveal(root);
    if (location.hash.length > 1) {
      const id = decodeURIComponent(location.hash.slice(1));
      setTimeout(() => scrollToId(id), 450);
    }
    return off;
  }, []);
  useEffect(() => {
    startLoops(rootRef.current!);
  }, [lang]);

  return (
    <div ref={rootRef} style={{ position: 'relative', minHeight: '100vh', overflowX: 'clip' }}>
      {!data.settings.storeOpen && (
        <div style={{ position: 'relative', zIndex: 61, background: 'var(--cocoa-deep)', color: 'var(--on-dark)', textAlign: 'center', fontSize: 13.5, padding: '9px 16px' }}>{pick(data.settings.closedMessage.ar, data.settings.closedMessage.en)}</div>
      )}
      <Header home />
      <Hero images={heroImgs} />
      <Marquee />
      <Gallery items={data.gallery} />
      <Menu tab={tab} setTab={setTab} />
      <Flowers photos={pool.length ? [photos[2] || pool[0], photos[3] || pool[1] || pool[0], photos[1] || pool[0]] : []} onBouquet={() => setTab(bouquetIdx)} />
      <CakeBuilder photos={pool.slice(0, 3)} />
      <Reviews reviews={data.reviews} />
      <ReviewShots shots={data.reviewShots} />
      <Contact />
      <Fab />
      <CartBar />
    </div>
  );
}
