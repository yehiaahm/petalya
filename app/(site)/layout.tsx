import { cookies } from 'next/headers';
import { getPublicData } from '@/lib/db';
import { SiteProvider } from '@/components/site/SiteProvider';
import { getUser, publicUser } from '@/lib/customer';

export const dynamic = 'force-dynamic';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [data, jar, user] = await Promise.all([getPublicData(), cookies(), getUser()]);
  const lang = jar.get('petalya.lang')?.value === 'en' ? 'en' : 'ar';
  return (
    <SiteProvider data={data} initialLang={lang} initialUser={publicUser(user)}>
      {children}
    </SiteProvider>
  );
}
