import './admin.css';

export const metadata = { title: { default: 'لوحة التحكم', template: '%s · لوحة تحكم Petalya' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return children;
}
