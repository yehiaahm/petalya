'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { MiniHeader } from './Checkout';

export function TrackForm() {
  const { pick, ar } = useSite();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const r = await fetch('/api/orders/lookup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, phone }) });
    setBusy(false);
    if (!r.ok) return setErr(pick('مش لاقيين طلب بالرقم ده — اتأكد من رقم الطلب والموبايل.', 'We couldn’t find that order — check the order number and phone.'));
    router.push('/order/' + (await r.json()).id);
  };
  return (
    <div className="page-bg">
      <MiniHeader />
      <main className="wrap" style={{ maxWidth: 520, padding: 'clamp(40px,8vw,80px) 20px' }}>
        <div className="center">
          <div className="eyebrow"><span>{pick('تابع طلبك', 'Follow your order')}</span></div>
          <h1 className="h2" style={{ fontSize: ar ? 'clamp(32px,7vw,48px)' : 'clamp(40px,8vw,60px)' }}>
            {ar ? <>طلبك <span className="accent">فين؟</span></> : <>Where’s <em className="accent">my</em> cake?</>}
          </h1>
        </div>
        <form onSubmit={submit} className="card card-pad" style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="field">
            <span>{pick('رقم الطلب', 'Order number')}</span>
            <input className="input ltr" style={{ textAlign: ar ? 'right' : 'left' }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="PT-1001" required />
          </label>
          <label className="field">
            <span>{pick('رقم الموبايل', 'Mobile number')}</span>
            <input className="input ltr" style={{ textAlign: ar ? 'right' : 'left' }} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="01xxxxxxxxx" required />
          </label>
          {err && <span className="err-text">{err}</span>}
          <button className="btn btn-flat btn-md" disabled={busy} data-burst="1">
            <MagnifyingGlass size={19} />
            {pick('دوّر على طلبي', 'Find my order')}
          </button>
        </form>
      </main>
    </div>
  );
}
