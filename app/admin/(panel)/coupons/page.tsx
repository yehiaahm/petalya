import { readDB } from '@/lib/db';
import { CouponsEditor } from '@/components/admin/ContentEditors';

export const metadata = { title: 'أكواد الخصم' };

export default async function Page() {
  const db = await readDB();
  return <CouponsEditor coupons={db.coupons} />;
}
