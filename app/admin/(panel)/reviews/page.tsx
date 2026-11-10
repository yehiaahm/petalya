import { readDB } from '@/lib/db';
import { ReviewShotsEditor, ReviewsEditor } from '@/components/admin/ContentEditors';

export const metadata = { title: 'آراء العملاء' };

export default async function Page() {
  const db = await readDB();
  return (
    <>
      <ReviewsEditor reviews={db.reviews} />
      <div style={{ height: 22 }} />
      <ReviewShotsEditor shots={db.reviewShots} />
    </>
  );
}
