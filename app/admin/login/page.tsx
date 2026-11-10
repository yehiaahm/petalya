import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import { LoginForm } from '@/components/admin/LoginForm';

export const metadata = { title: 'تسجيل الدخول' };

export default async function LoginPage() {
  if (await isAdmin()) redirect('/admin');
  return <LoginForm />;
}
