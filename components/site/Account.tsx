'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowsClockwise, Cake, Check, Lock, Receipt, SignOut, UserCircle } from '@phosphor-icons/react';
import type { Order } from '@/lib/types';
import { fmtDate, STATUS_LABEL } from '@/lib/pricing';
import { useSite } from './SiteProvider';
import { CakeSwatch, MiniHeader } from './Checkout';
import { FwdIcon } from './Chrome';
import { arCount } from '@/lib/ar';

type OrderCard = Pick<Order, 'id' | 'code' | 'createdAt' | 'status' | 'total' | 'items' | 'fulfillment' | 'quote'>;

const STATUS_STYLE: Record<string, [string, string]> = {
  new: ['#FCE3DC', '#A2483A'],
  confirmed: ['#E2EBF5', '#3F5F86'],
  preparing: ['#FBEFD6', '#9A6A1E'],
  ready: ['#EFE5F6', '#6C4A8A'],
  out_for_delivery: ['#E0F0F0', '#2E6B6B'],
  delivered: ['#E9F0DF', '#5E7D40'],
  cancelled: ['#EDE6E2', '#7A6A62'],
};

export function Account({ orders }: { orders: OrderCard[] }) {
  const { user, setUser, pick, t, fmt, lang, data, add, addCustom, toast, ar, showPrices } = useSite();
  const router = useRouter();
  const [tab, setTab] = useState<'orders' | 'profile'>('orders');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [zoneId, setZoneId] = useState(user?.zoneId ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState('');

  if (!user) return null;
  const zones = data.settings.zones.filter((z) => z.active);
  const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    location.href = '/';
  };
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await fetch('/api/account', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, phone, zoneId, address }) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.message ? t(j.message) : pick('حدث خطأ، حاول مرة أخرى', 'Something went wrong'));
    setUser(j.user);
    toast(pick('تم حفظ بياناتك', 'Your details were saved'));
    router.refresh();
  };
  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg('');
    const r = await fetch('/api/account/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(pw) });
    if (r.ok) {
      setPw({ current: '', next: '' });
      setUser({ ...user, hasPassword: true });
      toast(pick('تم تغيير كلمة المرور', 'Password updated'));
    } else setPwMsg(r.status === 403 ? pick('كلمة المرور الحالية غير صحيحة', 'Current password is wrong') : pick('يجب ألا تقل كلمة المرور عن ٨ أحرف', 'Use at least 8 characters'));
  };
  const reorder = (o: OrderCard) => {
    let n = 0;
    o.items.forEach((it) => {
      if (it.kind === 'product' && it.productId && data.products.some((p) => p.id === it.productId && !p.soldOut)) {
        add(it.productId, it.qty);
        n++;
      } else if (it.kind === 'custom' && it.design) {
        addCustom({ ...it.design, date: '' });
        n++;
      }
    });
    if (n) router.push('/checkout');
    else toast(pick('هذه المنتجات لم تعد متاحة', 'Those items are no longer available'));
  };

  return (
    <div className="page-bg">
      <MiniHeader />
      <main className="wrap" style={{ maxWidth: 880, padding: 'clamp(24px,5vw,48px) clamp(16px,4vw,32px) 90px' }}>
        <div className="card card-pad" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: 'radial-gradient(80% 140% at 100% 0%, rgba(242,198,189,.55), transparent 60%), var(--paper)' }}>
          <span style={{ width: 68, height: 68, borderRadius: '50%', overflow: 'hidden', flex: 'none', background: 'var(--petal)', display: 'grid', placeItems: 'center', font: '600 26px/1 var(--f-messiri), serif', boxShadow: '0 0 0 4px var(--paper), 0 0 0 5px rgba(196,146,116,.35)' }}>
            {user.avatar ? <img className="cover" src={user.avatar} alt="" referrerPolicy="no-referrer" /> : user.name.charAt(0)}
          </span>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h1 style={{ margin: 0, font: ar ? '600 26px/1.3 var(--f-messiri), serif' : '500 34px/1.1 var(--f-cormorant), serif' }}>{pick(`أهلًا ${user.name.split(' ')[0]}`, `Hi, ${user.name.split(' ')[0]}`)}</h1>
            <span className="ltr" style={{ color: 'var(--ink-muted)', fontSize: 14 }}>{user.email}</span>
            {user.google && <span style={{ marginInlineStart: 8, fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#EEF3FD', color: '#3F5F86' }}>Google</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            <SignOut size={18} />
            {pick('تسجيل الخروج', 'Sign out')}
          </button>
        </div>

        <div className="seg" style={{ margin: '18px 0', maxWidth: 420 }} role="tablist">
          <span className="slider" style={{ width: 'calc((100% - 10px) / 2)', insetInlineStart: tab === 'orders' ? '5px' : 'calc(5px + (100% - 10px) / 2)' }} />
          <button role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>
            <Receipt size={18} />
            {pick('طلباتي', 'My orders')} {orders.length > 0 && <span className="num">({orders.length})</span>}
          </button>
          <button role="tab" aria-selected={tab === 'profile'} className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}>
            <UserCircle size={18} />
            {pick('بياناتي', 'My details')}
          </button>
        </div>

        {tab === 'orders' &&
          (orders.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {active.length > 0 && <p style={{ margin: '0 4px', fontSize: 13.5, color: 'var(--ink-muted)' }}>{pick(`لديك ${arCount(active.length, 'order')} قيد التنفيذ`, `${active.length} order(s) in progress`)}</p>}
              {orders.map((o) => {
                const [bg, fg] = STATUS_STYLE[o.status];
                const first = o.items[0];
                return (
                  <div key={o.id} className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="th" style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', background: 'var(--blush-tile)', display: 'grid', placeItems: 'center', flex: 'none', color: 'var(--copper-icon)' }}>
                      {first?.image ? <img className="cover" src={first.image} alt="" /> : first?.kind === 'custom' ? <CakeSwatch colour={first.colour} /> : <Cake size={26} />}
                    </span>
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <b className="ltr num">{o.code}</b>
                        <span style={{ fontSize: 12.5, fontWeight: 600, padding: '3px 10px', borderRadius: 99, background: bg, color: fg }}>{t(STATUS_LABEL[o.status])}</span>
                      </div>
                      <div style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.items.map((i) => `${i.qty}× ${t(i.name)}`).join(lang === 'ar' ? '، ' : ', ')}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>
                        {pick('موعد التسليم ', 'Due ')}
                        {fmtDate(o.fulfillment.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })}
                        {(showPrices || o.quote) && (
                          <>
                            {' · '}
                            <span className="num">{fmt(o.total)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => reorder(o)} data-burst="1">
                        <ArrowsClockwise size={17} />
                        {pick('إعادة الطلب', 'Reorder')}
                      </button>
                      <Link href={`/order/${o.id}`} className="btn btn-flat btn-sm">
                        {pick('تتبّع', 'Track')}
                        <FwdIcon size={16} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card card-pad center">
              <div style={{ width: 90, height: 90, margin: '0 auto', borderRadius: '50%', background: 'var(--blush-tile)', display: 'grid', placeItems: 'center', color: 'var(--copper-icon)' }}>
                <Receipt size={40} weight="light" />
              </div>
              <h2 className="card-title" style={{ justifyContent: 'center', marginTop: 14 }}>{pick('لا توجد طلبات بعد', 'No orders yet')}</h2>
              <p style={{ margin: '0 0 18px', color: 'var(--ink-muted)' }}>{pick('ستظهر هنا الطلبات التي تطلبها وأنت مسجّل الدخول.', 'Orders you place while signed in will show up here.')}</p>
              <Link href="/#menu" className="btn btn-primary">
                {pick('تصفّح المنيو', 'Browse the menu')}
                <FwdIcon />
              </Link>
            </div>
          ))}

        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <form className="card card-pad" onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 className="card-title" style={{ margin: 0 }}>{pick('بيانات الطلب', 'Your order details')}</h2>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-muted)' }}>{pick('سنملؤها لك تلقائيًا عند إتمام الطلب.', 'We’ll fill these in for you at checkout.')}</p>
              <div className="grid-2">
                <label className="field">
                  <span>{pick('الاسم', 'Name')}</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </label>
                <label className="field">
                  <span>{pick('رقم الموبايل (واتساب)', 'Mobile (WhatsApp)')}</span>
                  <input className={'input ltr' + (err ? ' err' : '')} style={{ textAlign: ar ? 'right' : 'left' }} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="01xxxxxxxxx" autoComplete="tel" />
                </label>
              </div>
              <div className="field">
                <span>{pick('منطقة التوصيل', 'Delivery area')}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {zones.map((z) => (
                    <button type="button" key={z.id} className={'chip-opt sm' + (zoneId === z.id ? ' on' : '')} onClick={() => setZoneId(zoneId === z.id ? '' : z.id)} aria-pressed={zoneId === z.id}>
                      {zoneId === z.id && <Check size={13} weight="bold" />}
                      {t(z.name)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="field">
                <span>{pick('العنوان', 'Address')}</span>
                <textarea className="input" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
              </label>
              {err && <span className="err-text">{err}</span>}
              <button className="btn btn-flat btn-md" disabled={busy} style={{ alignSelf: 'flex-start' }}>
                {pick('حفظ', 'Save')}
              </button>
            </form>

            <form className="card card-pad" onSubmit={savePw} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 className="card-title" style={{ margin: 0 }}>
                <Lock size={22} color="#B97E5E" />
                {user.hasPassword ? pick('تغيير كلمة المرور', 'Change password') : pick('إنشاء كلمة مرور', 'Set a password')}
              </h2>
              {!user.hasPassword && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-muted)' }}>{pick('سجّلت باستخدام Google. أنشئ كلمة مرور إذا أردت تسجيل الدخول بالبريد الإلكتروني أيضًا.', 'You signed up with Google. Set a password to sign in with email too.')}</p>}
              <div className="grid-2">
                {user.hasPassword && (
                  <label className="field">
                    <span>{pick('كلمة المرور الحالية', 'Current password')}</span>
                    <input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
                  </label>
                )}
                <label className="field">
                  <span>{pick('كلمة المرور الجديدة', 'New password')}</span>
                  <input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
                </label>
              </div>
              {pwMsg && <span className="err-text">{pwMsg}</span>}
              <button className="btn btn-ghost btn-md" disabled={pw.next.length < 8} style={{ alignSelf: 'flex-start' }}>
                {pick('حفظ كلمة المرور', 'Save password')}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
