'use client';

import { useState } from 'react';
import { Eye, EyeSlash, Lock } from '@phosphor-icons/react';
import { LogoRing } from '@/components/site/Hero';

export function LoginForm() {
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (r.ok) {
      location.href = '/admin';
      return;
    }
    setBusy(false);
    setErr(r.status === 429 ? 'محاولات كتير — استنى دقيقة وجرّب تاني.' : 'كلمة السر مش صح.');
  };
  return (
    <div className="adm login-bg" dir="rtl" lang="ar">
      <form onSubmit={submit} className="a-card" style={{ width: 'min(100%, 400px)', padding: '34px 28px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ position: 'relative', width: 128, height: 128, margin: '0 auto' }}>
          <LogoRing id="login-ring" size={9} spacing={2.6} stroke={0.6} dotted={false} />
          <div style={{ position: 'absolute', inset: '12.5%', borderRadius: '50%', overflow: 'hidden', boxShadow: '0 20px 34px -18px rgba(74,44,34,.55), 0 0 0 4px rgba(255,252,248,.8), 0 0 0 5px rgba(196,146,116,.35)' }}>
            <img src="/assets/logo.png" alt="Petalya" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>
        <div>
          <h1 style={{ fontSize: 26 }}>مرحبًا بعودتك</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>تسجيل الدخول للوحة تحكم Petalya</p>
        </div>
        <label className="af" style={{ textAlign: 'start' }}>
          <span>كلمة السر</span>
          <div style={{ position: 'relative' }}>
            <input className="ai" type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="current-password" style={{ paddingInlineEnd: 44, height: 50 }} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'إخفاء' : 'إظهار'} style={{ position: 'absolute', top: 0, bottom: 0, insetInlineEnd: 6, width: 38, border: 0, background: 'none', color: 'var(--ink-muted)', cursor: 'pointer' }}>
              {show ? <EyeSlash size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </label>
        {err && <span className="small" style={{ color: 'var(--bad)' }}>{err}</span>}
        <button className="ab primary" style={{ height: 50 }} disabled={busy || !pw}>
          <Lock size={18} />
          {busy ? 'لحظة…' : 'دخول'}
        </button>
        <a href="/" className="small">← رجوع للموقع</a>
      </form>
    </div>
  );
}
