import { readDB } from '@/lib/db';
import { ReviewsEditor } from '@/components/admin/ContentEditors';

export const metadata = { title: 'آراء العملاء' };

export default async function Page() {
  const db = await readDB();
  return <ReviewsEditor reviews={db.reviews} />;
}
