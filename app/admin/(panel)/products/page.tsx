import { readDB } from '@/lib/db';
import { Products } from '@/components/admin/Products';

export const metadata = { title: 'المنتجات' };

export default async function ProductsPage() {
  const db = await readDB();
  const sales: Record<string, number> = {};
  db.orders.filter((o) => o.status !== 'cancelled').forEach((o) => o.items.forEach((i) => i.productId && (sales[i.productId] = (sales[i.productId] || 0) + i.qty)));
  return <Products products={db.products} categories={[...db.categories].sort((a, b) => a.sort - b.sort)} sales={sales} />;
}
