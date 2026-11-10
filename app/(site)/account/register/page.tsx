import { redirect } from 'next/navigation';
import { getUser, googleConfigured, safeNext } from '@/lib/customer';
import { AuthForm } from '@/components/site/AuthForm';

export const metadata = { title: 'Create account', robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getUser()) redirect(next);
  return <AuthForm mode="register" next={next} error={sp.error} googleEnabled={googleConfigured()} />;
}
