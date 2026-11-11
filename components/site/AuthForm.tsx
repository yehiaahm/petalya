'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Eye, EyeSlash, Info, SignIn, UserPlus } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { MiniHeader } from './Checkout';
import { LogoRing } from './Hero';

export function GoogleButton({ next, label }: { next: string; label: string }) {
  return (
    <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="btn google-btn" data-burst="1">
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {label}
    </a>
  );
}

const ERRORS: Record<string, [string, string]> = {
  google_off: ['تسجيل الدخول باستخدام Google غير مفعّل بعد.', 'Google sign-in isn’t switched on yet.'],
  google_cancelled: ['تم إلغاء تسجيل الدخول باستخدام Google.', 'Google sign-in was cancelled.'],
  google_state: ['انتهت مهلة تسجيل الدخول. حاول مرة أخرى.', 'The sign-in session expired — please try again.'],
  google_token: ['لم يُرسل Google بيانات الدخول. حاول مرة أخرى.', 'Google didn’t return a sign-in — please try again.'],
  google_profile: ['تعذّر الحصول على بياناتك من Google.', 'We couldn’t read your Google profile.'],
  google_failed: ['تعذّر تسجيل الدخول باستخدام Google. حاول مرة أخرى.', 'Google sign-in failed — please try again.'],
};

export function AuthForm({ mode: initialMode, next, error, googleEnabled }: { mode: 'login' | 'register'; next: string; error?: string; googleEnabled: boolean }) {
  const { pick, ar, setUser, burst, wa } = useSite();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [field, setField] = useState('');
  const [msg, setMsg] = useState(error && ERRORS[error] ? pick(...ERRORS[error]) : '');

  useEffect(() => {
    history.replaceState(null, '', `/account/${mode === 'login' ? 'login' : 'register'}${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`);
    setField('');
  }, [mode, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setField('');
    setBusy(true);
    const r = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(mode === 'login' ? { email, password } : { name, email, password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(false);
      setField(j.error || '');
      setMsg(j.message ? (ar ? j.message.ar : j.message.en) : pick('حدث خطأ، حاول مرة أخرى.', 'Something went wrong, please try again.'));
      return;
    }
    setUser(j.user);
    const b = (e.target as HTMLElement).querySelector('button[type=submit]')?.getBoundingClientRect();
    if (b) burst(b.left + b.width / 2, b.top + b.height / 2, 20);
    location.href = next;
  };

  const isLogin = mode === 'login';
  return (
    <div className="page-bg">
      <MiniHeader />
      <main className="wrap" style={{ maxWidth: 480, padding: 'clamp(28px,6vw,64px) 16px 80px' }}>
        <div className="center">
          <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
            <LogoRing id="auth-ring" size={9} spacing={2.6} stroke={0.6} dotted={false} />
            <div style={{ position: 'absolute', inset: '12.5%', borderRadius: '50%', overflow: 'hidden', boxShadow: '0 20px 34px -18px rgba(74,44,34,.55), 0 0 0 4px rgba(255,252,248,.8), 0 0 0 5px rgba(196,146,116,.35)' }}>
              <img className="cover" src="/assets/logo.png" alt="Petalya" />
            </div>
          </div>
          <h1 className="h2" style={{ fontSize: ar ? 'clamp(30px,7vw,42px)' : 'clamp(38px,8vw,54px)' }}>
            {isLogin ? (
              ar ? (
                <>
                  أهلًا <span className="accent">بعودتك</span>
                </>
              ) : (
                <>
                  Welcome <em className="accent">back</em>
                </>
              )
            ) : ar ? (
              <>
                أنشئ <span className="accent">حسابك</span>
              </>
            ) : (
              <>
                Create <em className="accent">your</em> account
              </>
            )}
          </h1>
          <p className="intro" style={{ marginTop: 10 }}>{pick('تابع طلباتك، وأعد الطلب بضغطة واحدة، واحفظ بياناتك للمرة القادمة.', 'Follow your orders, reorder in one tap, and skip typing your details next time.')}</p>
        </div>

        <div className="card card-pad" style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="seg" role="tablist">
            <span className="slider" style={{ width: 'calc((100% - 10px) / 2)', insetInlineStart: isLogin ? '5px' : 'calc(5px + (100% - 10px) / 2)' }} />
            <button type="button" role="tab" aria-selected={isLogin} className={isLogin ? 'on' : ''} onClick={() => setMode('login')}>
              {pick('تسجيل الدخول', 'Sign in')}
            </button>
            <button type="button" role="tab" aria-selected={!isLogin} className={!isLogin ? 'on' : ''} onClick={() => setMode('register')}>
              {pick('إنشاء حساب', 'Sign up')}
            </button>
          </div>

          {googleEnabled ? (
            <GoogleButton next={next} label={pick('المتابعة باستخدام Google', 'Continue with Google')} />
          ) : (
            <p className="menu-note" style={{ margin: 0, justifyContent: 'flex-start', textAlign: 'start', fontSize: 12.5 }}>
              <Info size={15} color="#B97E5E" style={{ flex: 'none' }} />
              {pick('سيظهر هنا خيار تسجيل الدخول باستخدام Google فور تفعيله.', 'Google sign-in will appear here once it is set up.')}
            </p>
          )}
          {googleEnabled && (
            <div className="or-line">
              <span>{pick('أو بالبريد الإلكتروني', 'or with email')}</span>
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }} noValidate>
            {!isLogin && (
              <label className="field">
                <span>{pick('الاسم', 'Name')}</span>
                <input className={'input' + (field === 'name' ? ' err' : '')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </label>
            )}
            <label className="field">
              <span>{pick('البريد الإلكتروني', 'Email')}</span>
              <input className={'input ltr' + (field === 'email' || field === 'credentials' ? ' err' : '')} style={{ textAlign: ar ? 'right' : 'left' }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="name@email.com" required />
            </label>
            <label className="field">
              <span>{pick('كلمة المرور', 'Password')}</span>
              <div style={{ position: 'relative' }}>
                <input
                  className={'input' + (field === 'password' || field === 'credentials' ? ' err' : '')}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  style={{ paddingInlineEnd: 48 }}
                  required
                />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? pick('إخفاء', 'Hide') : pick('إظهار', 'Show')} style={{ position: 'absolute', top: 0, bottom: 0, insetInlineEnd: 8, width: 38, border: 0, background: 'none', color: 'var(--ink-muted)', cursor: 'pointer' }}>
                  {show ? <EyeSlash size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {!isLogin && <span style={{ fontSize: 12.5, fontWeight: 400 }}>{pick('٨ أحرف على الأقل', 'At least 8 characters')}</span>}
            </label>
            {msg && (
              <div role="alert" style={{ padding: '11px 14px', borderRadius: 14, background: '#FBE4E0', color: '#8F3A2F', fontSize: 14 }}>
                {msg}
              </div>
            )}
            <button type="submit" className="btn btn-flat btn-md" disabled={busy} data-burst="1" style={{ width: '100%' }}>
              {isLogin ? <SignIn size={19} /> : <UserPlus size={19} />}
              {busy ? pick('لحظة…', 'One moment…') : isLogin ? pick('تسجيل الدخول', 'Sign in') : pick('إنشاء الحساب', 'Create account')}
            </button>
          </form>
          {isLogin && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-muted)', textAlign: 'center' }}>
              {pick('نسيت كلمة المرور؟ ', 'Forgot your password? ')}
              {googleEnabled ? pick('سجّل الدخول باستخدام Google بنفس البريد الإلكتروني، أو ', 'Use Google with the same email, or ') : ''}
              <a href={wa(pick('أهلًا Petalya! نسيت كلمة المرور الخاصة بحسابي على الموقع.', 'Hi Petalya! I forgot my account password.'))} target="_blank" rel="noopener">
                {pick('راسلنا على واتساب', 'message us on WhatsApp')}
              </a>
              {pick(' وسنساعدك.', ' and we’ll help.')}
            </p>
          )}
        </div>
        <p className="center" style={{ marginTop: 20, fontSize: 14 }}>
          <Link href={next.startsWith('/checkout') ? '/checkout' : '/'}>{next.startsWith('/checkout') ? pick('أكمل الطلب بدون حساب', 'Continue as a guest') : pick('العودة إلى الموقع', 'Back to the site')}</Link>
        </p>
      </main>
    </div>
  );
}
