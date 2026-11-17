import { readDBAsAdmin } from '@/lib/admin-data';
import { ReviewShotsEditor, ReviewsEditor } from '@/components/admin/ContentEditors';

export const metadata = { title: 'آراء العملاء' };

export default async function Page() {
  const db = await readDBAsAdmin();
  return (
    <>
      <ReviewsEditor reviews={db.reviews} />
      <div style={{ height: 22 }} />
      <ReviewShotsEditor shots={db.reviewShots} />
    </>
  );
}
