import { readDBAsAdmin } from '@/lib/admin-data';
import { CouponsEditor } from '@/components/admin/ContentEditors';

export const metadata = { title: 'أكواد الخصم' };

export default async function Page() {
  const db = await readDBAsAdmin();
  return <CouponsEditor coupons={db.coupons} />;
}
