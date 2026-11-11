import { notFound } from 'next/navigation';
import { readDB } from '@/lib/db';
import { ProductEditor } from '@/components/admin/ProductEditor';

export const metadata = { title: 'تعديل منتج' };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDB();
  const cats = [...db.categories].sort((a, b) => a.sort - b.sort);
  if (id === 'new') return <ProductEditor product={null} categories={cats} />;
  const p = db.products.find((x) => x.id === id);
  if (!p) notFound();
  return <ProductEditor key={p.id} product={p} categories={cats} />;
}
