import { readDBAsAdmin } from '@/lib/admin-data';
import { SettingsEditor } from '@/components/admin/SettingsEditor';

export const metadata = { title: 'الإعدادات' };

export default async function Page() {
  const db = await readDBAsAdmin();
  return <SettingsEditor settings={db.settings} hasDemo={db.orders.some((o) => o.demo)} />;
}
