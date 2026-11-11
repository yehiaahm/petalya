import { readDB } from '@/lib/db';
import { GalleryEditor } from '@/components/admin/ContentEditors';

export const metadata = { title: 'معرض الأعمال' };

export default async function Page() {
  const db = await readDB();
  const products = [...db.products].sort((a, b) => a.sort - b.sort).map((p) => ({ id: p.id, name: p.name.ar }));
  return <GalleryEditor items={[...db.gallery].sort((a, b) => a.sort - b.sort)} products={products} />;
}
