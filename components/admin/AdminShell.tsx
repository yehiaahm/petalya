'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, Cake, ChartLineUp, ChatCircleText, Gear, House, Images, List, MagnifyingGlass, Receipt, SignOut, Storefront, Ticket, Users, X } from '@phosphor-icons/react';
import { AdminProvider, api, egp } from './ui';
import { PhoneAlerts } from './PhoneAlerts';

type Summary = { newOrders: number; pendingReviews: number; latest: { id: string; code: string; name: string; total: number; createdAt: string } | null };

const NAV = [
  { grp: 'المتجر' },
  { href: '/admin', label: 'نظرة عامة', icon: House, exact: true },
  { href: '/admin/orders', label: 'الطلبات', icon: Receipt, badge: 'orders' },
  { href: '/admin/customers', label: 'العملاء', icon: Users },
  { href: '/admin/analytics', label: 'الزيارات والتحليلات', icon: ChartLineUp },
  { grp: 'المحتوى' },
  { href: '/admin/products', label: 'المنتجات والمنيو', icon: Cake },
  { href: '/admin/gallery', label: 'معرض الشغل', icon: Images },
  { href: '/admin/reviews', label: 'آراء العملاء', icon: ChatCircleText, badge: 'reviews' },
  { href: '/admin/coupons', label: 'أكواد الخصم', icon: Ticket },
  { grp: 'الإدارة' },
  { href: '/admin/settings', label: 'الإعدادات', icon: Gear },
] as const;

function chime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [880, 1174.7, 1568].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.55);
    });
  } catch {}
}

export function AdminShell({ children, initial }: { children: React.ReactNode; initial: Summary }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sum, setSum] = useState<Summary>(initial);
  const [alert, setAlert] = useState<Summary['latest']>(null);
  const lastId = useRef(initial.latest?.id);
  const [q, setQ] = useState('');

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    const poll = async () => {
      try {
        const s = await api<Summary>('/api/admin/summary');
        setSum(s);
        if (s.latest && s.latest.id !== lastId.current) {
          lastId.current = s.latest.id;
          setAlert(s.latest);
          chime();
          router.refresh();
        }
      } catch {}
    };
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [router]);

  // Red count on the app icon (installed app only), like WhatsApp.
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    (sum.newOrders ? nav.setAppBadge?.(sum.newOrders) : nav.clearAppBadge?.())?.catch(() => {});
  }, [sum.newOrders]);

  useEffect(() => {
    document.title = (sum.newOrders ? `(${sum.newOrders}) ` : '') + 'لوحة تحكم Petalya';
  }, [sum.newOrders, path]);

  useEffect(() => {
    if (!alert) return;
    const id = setTimeout(() => setAlert(null), 12000);
    return () => clearTimeout(id);
  }, [alert]);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    location.href = '/admin/login';
  };


  return (
    <AdminProvider>
      <div className={'adm' + (open ? ' menu-open' : '')} dir="rtl" lang="ar">
        <aside className="adm-side" aria-label="القائمة">
          <Link href="/admin" className="adm-brand">
            <img src="/assets/logo.png" alt="" />
            <span>
              <b>Petalya</b>
              <small>لوحة التحكم</small>
            </span>
          </Link>
          <nav className="adm-nav">
            {NAV.map((n, i) => {
              if ('grp' in n) return <div key={i} className="grp">{n.grp}</div>;
              const on = 'exact' in n && n.exact ? path === n.href : path.startsWith(n.href);
              const Ic = n.icon;
              const b = 'badge' in n ? (n.badge === 'orders' ? sum.newOrders : sum.pendingReviews) : 0;
              return (
                <Link key={n.href} href={n.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                  <Ic size={21} weight={on ? 'fill' : 'regular'} />
                  {n.label}
                  {b > 0 && <span className="b">{b}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="foot">
            <a href="/" target="_blank" rel="noopener">
              <Storefront size={20} />
              افتح الموقع
            </a>
            <button onClick={logout}>
              <SignOut size={20} />
              تسجيل خروج
            </button>
          </div>
        </aside>
        <div className="adm-scrim" onClick={() => setOpen(false)} />
        <div className="adm-main">
          <header className="adm-top">
            <button className="ab ghost icon adm-burger" onClick={() => setOpen(true)} aria-label="القائمة">
              <List size={20} />
            </button>
            <form
              className="search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push('/admin/orders?q=' + encodeURIComponent(q.trim()));
              }}
            >
              <MagnifyingGlass size={18} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر على طلب، اسم أو رقم موبايل…" aria-label="بحث" />
            </form>
            <div style={{ flex: 1 }} />
            <Link href="/admin/orders?status=new" className="ab ghost icon" aria-label="الطلبات الجديدة" style={{ position: 'relative' }}>
              <Bell size={20} weight={sum.newOrders ? 'fill' : 'regular'} />
              {sum.newOrders > 0 && <span style={{ position: 'absolute', top: -3, insetInlineEnd: -3, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 99, background: '#E8A398', color: 'var(--cocoa-deep)', fontSize: 11.5, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{sum.newOrders}</span>}
            </Link>
            <span className="av" title="أمنية" style={{ width: 40, height: 40 }}>
              أ
            </span>
          </header>
          <main className="adm-content">
            {path !== '/admin/settings' && <PhoneAlerts />}
            {children}
          </main>
        </div>

        {alert && (
          <div className="alert-pop" role="alert">
            <span className="ic">
              <Bell size={22} weight="fill" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block' }}>طلب جديد! {alert.code}</b>
              <span style={{ fontSize: 13.5, color: 'var(--on-dark-muted)' }}>
                {alert.name} · {egp(alert.total)}
              </span>
              <div style={{ marginTop: 10 }}>
                <Link href={`/admin/orders/${alert.id}`} className="ab sm" style={{ background: 'var(--petal)', color: 'var(--cocoa-deep)' }} onClick={() => setAlert(null)}>
                  افتح الطلب
                </Link>
              </div>
            </div>
            <button onClick={() => setAlert(null)} aria-label="إغلاق" style={{ background: 'none', border: 0, color: 'var(--on-dark-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </AdminProvider>
  );
}
