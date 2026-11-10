import { readDB } from '@/lib/db';
import { SettingsEditor } from '@/components/admin/SettingsEditor';

export const metadata = { title: 'الإعدادات' };

export default async function Page() {
  const db = await readDB();
  return <SettingsEditor settings={db.settings} hasDemo={db.orders.some((o) => o.demo)} />;
}
