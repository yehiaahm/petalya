'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Cake, CalendarBlank, Check, ImageSquare, Info, Lock, Minus, Moped, Money, Plus, ShoppingBagOpen, Storefront, Tag, Trash, Wallet, CreditCard, X } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { AccountButton, BackIcon, FwdIcon, LangToggle } from './Chrome';
import { isoDay } from '@/lib/pricing';
import { uploadReference } from '@/lib/client-image';
import type { PaymentMethod } from '@/lib/types';

type Coupon = { code: string; discount: number; type: string; value: number; minSubtotal: number };

export function MiniHeader({ back = '/', backLabel }: { back?: string; backLabel?: string }) {
  const { pick } = useSite();
  return (
    <header className="site-header scrolled no-print">
      <div className="row">
        <Link href={back} className="icon-btn" aria-label={backLabel || pick('رجوع', 'Back')}>
          <BackIcon />
        </Link>
        <Link href="/" className="brand" aria-label="Petalya">
          <img src="/assets/logo.png" alt="" />
          <span className="wordmark">Petalya</span>
        </Link>
        <div className="spacer" />
        <LangToggle />
        <AccountButton />
      </div>
    </header>
  );
}

export function CakeSwatch({ colour, size = 64 }: { colour?: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, display: 'grid', placeItems: 'center', background: 'radial-gradient(90% 70% at 50% 28%, #FFF7F2 0%, #F7E0D7 70%, #F1D2C6 100%)' }}>
      <span style={{ position: 'relative', width: size * 0.56, height: size * 0.5 }}>
        <span style={{ position: 'absolute', left: '15%', right: '15%', top: 0, height: '46%', borderRadius: '6px 6px 4px 4px', background: colour || '#F3CBC2', boxShadow: 'inset 0 -4px 6px -4px rgba(74,44,34,.3)' }} />
        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '56%', borderRadius: '7px 7px 5px 5px', background: colour || '#F3CBC2', boxShadow: 'inset 0 -5px 8px -5px rgba(74,44,34,.3)' }} />
      </span>
    </span>
  );
}

export function Checkout() {
  const { lines, setQty, subtotal, fmt, t, pick, ar, lang, data, clear, track, burst, hydrated, user, showPrices } = useSite();
  const s = data.settings;
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState<'delivery' | 'pickup'>(s.deliveryEnabled ? 'delivery' : 'pickup');
  const zones = s.zones.filter((z) => z.active);
  const [zoneId, setZoneId] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [slotId, setSlotId] = useState(s.timeSlots[0]?.id || '');
  const methods = (['cod', 'instapay', 'wallet'] as PaymentMethod[]).filter((m) => s.payments[m]?.enabled);
  const [payment, setPayment] = useState<PaymentMethod>(methods[0] || 'cod');
  const [notes, setNotes] = useState('');
  const [refs, setRefs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [refMsg, setRefMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [couponIn, setCouponIn] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverErr, setServerErr] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const lead = useMemo(() => {
    let d = s.standardLeadDays;
    lines.forEach((l) => (d = Math.max(d, l.kind === 'custom' ? s.leadDays : l.product?.leadDays ?? 0)));
    return d;
  }, [lines, s]);
  const minDate = isoDay(lead);

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('petalya.customer') || '{}');
      if (c.name) setName(c.name);
      if (c.phone) setPhone(c.phone);
      if (c.email) setEmail(c.email);
      if (c.zoneId && zones.some((z) => z.id === c.zoneId)) setZoneId(c.zoneId);
      if (c.address) setAddress(c.address);
    } catch {}
    if (user) {
      setName(user.name);
      if (user.email) setEmail(user.email);
      if (user.phone) setPhone(user.phone);
      if (user.zoneId && zones.some((z) => z.id === user.zoneId)) setZoneId(user.zoneId);
      if (user.address) setAddress(user.address);
    }
    setReady(true);
    track('checkout_start');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let designDate = '';
    for (const l of lines) if (l.kind === 'custom' && l.design.date) designDate = l.design.date;
    setDate((d) => d || (designDate && designDate >= minDate ? designDate : ''));
  }, [lines, minDate]);

  const zone = zones.find((z) => z.id === zoneId);
  const fee = type === 'delivery' ? zone?.fee ?? 0 : 0;
  const discount = coupon && subtotal >= coupon.minSubtotal ? (coupon.type === 'percent' ? Math.round((subtotal * coupon.value) / 100) : Math.min(subtotal, coupon.value)) : 0;
  const total = Math.max(0, subtotal + fee - discount);

  const applyCoupon = async () => {
    setCouponMsg('');
    const code = couponIn.trim();
    if (!code) return;
    const r = await fetch('/api/coupons', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, subtotal }) }).then((x) => x.json());
    if (r.ok) {
      setCoupon(r);
      setCouponIn('');
    } else setCouponMsg(r.reason === 'min' ? (showPrices ? pick(`الكود ده للطلبات من ${fmt(r.min)}`, `This code needs a subtotal of ${fmt(r.min)}`) : pick('الكود ده مش متاح للطلب ده', 'This code does not apply to this order')) : pick('الكود ده مش شغال', 'That code isn’t valid'));
  };

  const addRefs = async (files: FileList | null) => {
    if (!files?.length) return;
    setRefMsg('');
    const room = 4 - refs.length;
    const picked = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room);
    if (files.length > picked.length) setRefMsg(pick('أقصى حاجة ٤ صور.', 'Up to 4 photos.'));
    setUploading((n) => n + picked.length);
    for (const f of picked) {
      try {
        const url = await uploadReference(f);
        setRefs((r) => (r.length < 4 ? [...r, url] : r));
      } catch {
        setRefMsg(pick('الصورة دي ماترفعتش — جرّب صورة تانية أو بعد شوية.', 'That photo could not be uploaded — try another or wait a moment.'));
      }
      setUploading((n) => n - 1);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = pick('اكتب اسمك', 'Enter your name');
    const p = phone.replace(/[\s-]/g, '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/^\+?20/, '0');
    if (!/^01[0125]\d{8}$/.test(p)) e.phone = pick('رقم موبايل مصري ١١ رقم يبدأ بـ 01', '11-digit Egyptian mobile starting with 01');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = pick('الإيميل مش مظبوط', 'That email looks wrong');
    if (type === 'delivery') {
      if (!zone) e.zone = pick('اختار منطقتك', 'Choose your area');
      if (address.trim().length < 6) e.address = pick('اكتب العنوان بالتفصيل', 'Write the full address');
    }
    if (!date) e.date = pick('اختار اليوم', 'Pick a day');
    else if (date < minDate) e.date = pick(`أقرب ميعاد ${minDate}`, `Earliest date is ${minDate}`);
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerErr('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const first = formRef.current?.querySelector<HTMLElement>(`[data-field="${Object.keys(e)[0]}"]`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.querySelector<HTMLElement>('input,textarea,button')?.focus({ preventScroll: true });
      return;
    }
    setBusy(true);
    try {
      localStorage.setItem('petalya.customer', JSON.stringify({ name, phone, email, zoneId, address }));
    } catch {}
    const body = {
      lines: lines.map((l) => (l.kind === 'product' ? { kind: 'product', productId: l.productId, qty: l.qty } : { kind: 'custom', design: l.design, qty: l.qty })),
      customer: { name, phone, email },
      fulfillment: { type, zoneId, address, date, slotId },
      payment,
      notes,
      refImages: refs,
      coupon: coupon?.code,
      lang,
    };
    try {
      const r = await fetch('/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) {
        const msg = j.message ? t(j.message) : pick('حصلت مشكلة، جرّب تاني.', 'Something went wrong, please try again.');
        if (j.error && ['name', 'phone', 'email', 'zone', 'address', 'date'].includes(j.error)) setErrors({ [j.error]: msg });
        setServerErr(msg);
        setBusy(false);
        return;
      }
      clear();
      router.push(`/order/${j.id}?new=1`);
    } catch {
      setServerErr(pick('مفيش اتصال بالإنترنت، جرّب تاني.', 'No connection — please try again.'));
      setBusy(false);
    }
  };

  if (ready && hydrated && !lines.length && !busy) {
    return (
      <div className="page-bg">
        <MiniHeader />
        <main className="wrap" style={{ maxWidth: 520, padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ width: 120, height: 120, margin: '0 auto', borderRadius: '50%', background: 'var(--blush-tile)', display: 'grid', placeItems: 'center', color: 'var(--copper-icon)' }}>
            <ShoppingBagOpen size={52} weight="light" />
          </div>
          <h1 className="h2" style={{ fontSize: 'clamp(30px,7vw,44px)' }}>{pick('طلبك لسه فاضي', 'Your bag is empty')}</h1>
          <p className="intro">{pick('اختار من المنيو أو صمّم تورتتك بنفسك — وهتلاقيها هنا.', 'Pick something from the menu or design your own cake — it will show up here.')}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
            <Link href="/#menu" className="btn btn-primary">
              {pick('تصفّح المنيو', 'Browse the menu')}
              <FwdIcon />
            </Link>
            <Link href="/#custom" className="btn btn-outline">
              <Cake size={20} />
              {pick('صمّم تورتتك', 'Design your cake')}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const err = (k: string) => (errors[k] ? <span className="err-text">{errors[k]}</span> : null);
  const nTypes = Number(s.deliveryEnabled) + Number(s.pickupEnabled);
  const PayIc = { cod: Money, instapay: CreditCard, wallet: Wallet };

  return (
    <div className="page-bg">
      <MiniHeader back="/#menu" />
      <main className="wrap" style={{ maxWidth: 1160, padding: 'clamp(28px,5vw,56px) clamp(16px,4vw,48px) 120px' }}>
        <div className="center" style={{ marginBottom: 'clamp(24px,4vw,40px)' }}>
          <div className="eyebrow">
            <span>{pick('خطوة أخيرة', 'One last step')}</span>
          </div>
          <h1 className="h2" style={{ fontSize: ar ? 'clamp(32px,7vw,52px)' : 'clamp(40px,8vw,64px)' }}>
            {ar ? (
              <>
                أكمل <span className="accent">طلبك</span>
              </>
            ) : (
              <>
                Complete <em className="accent">your</em> order
              </>
            )}
          </h1>
        </div>
        {!s.storeOpen && (
          <div className="card card-pad" style={{ marginBottom: 18, background: 'var(--blush-tile)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Info size={22} color="#8A5537" />
            {t(s.closedMessage)}
          </div>
        )}
        <form ref={formRef} onSubmit={submit} noValidate style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {!user && (
              <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'var(--blush-panel)' }}>
                <span style={{ flex: 1, minWidth: 200, fontSize: 14 }}>{pick('عندك حساب؟ ادخل عشان نملا بياناتك وتتابع طلباتك من مكان واحد.', 'Have an account? Sign in to fill in your details and keep all your orders in one place.')}</span>
                <Link href="/account/login?next=/checkout" className="btn btn-ghost btn-sm">
                  {pick('تسجيل الدخول', 'Sign in')}
                </Link>
              </div>
            )}
            {/* 1 — contact */}
            <section className="card card-pad">
              <h2 className="card-title">
                <span className="step">1</span>
                {pick('بياناتك', 'Your details')}
              </h2>
              <div className="grid-2">
                <label className="field" data-field="name">
                  <span>{pick('الاسم', 'Name')}</span>
                  <input className={'input' + (errors.name ? ' err' : '')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={pick('اسمك', 'Your name')} />
                  {err('name')}
                </label>
                <label className="field" data-field="phone">
                  <span>{pick('رقم الموبايل (واتساب)', 'Mobile (WhatsApp)')}</span>
                  <input className={'input ltr' + (errors.phone ? ' err' : '')} style={{ textAlign: ar ? 'right' : 'left' }} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="01xxxxxxxxx" />
                  {err('phone')}
                </label>
              </div>
              <label className="field" data-field="email" style={{ marginTop: 12 }}>
                <span>
                  {pick('الإيميل', 'Email')} <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>{pick('(اختياري)', '(optional)')}</span>
                </span>
                <input className={'input ltr' + (errors.email ? ' err' : '')} style={{ textAlign: ar ? 'right' : 'left' }} value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="name@email.com" />
                {err('email')}
              </label>
            </section>

            {/* 2 — fulfilment */}
            <section className="card card-pad">
              <h2 className="card-title">
                <span className="step">2</span>
                {pick('التوصيل والميعاد', 'Delivery & date')}
              </h2>
              {nTypes > 1 && (
                <div className="seg" style={{ marginBottom: 16 }} role="radiogroup">
                  <span className="slider" style={{ width: 'calc((100% - 10px) / 2)', insetInlineStart: type === 'delivery' ? '5px' : 'calc(5px + (100% - 10px) / 2)' }} />
                  <button type="button" role="radio" aria-checked={type === 'delivery'} className={type === 'delivery' ? 'on' : ''} onClick={() => setType('delivery')} data-burst="1">
                    <Moped size={19} />
                    {pick('توصيل', 'Delivery')}
                  </button>
                  <button type="button" role="radio" aria-checked={type === 'pickup'} className={type === 'pickup' ? 'on' : ''} onClick={() => setType('pickup')} data-burst="1">
                    <Storefront size={19} />
                    {pick('استلام من المطبخ', 'Kitchen pick-up')}
                  </button>
                </div>
              )}
              {type === 'delivery' ? (
                <>
                  <div className="field" data-field="zone">
                    <span>{pick('المنطقة', 'Area')}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {zones.map((z) => (
                        <button type="button" key={z.id} className={'chip-opt sm' + (zoneId === z.id ? ' on' : '')} onClick={() => setZoneId(z.id)} aria-pressed={zoneId === z.id}>
                          {zoneId === z.id && <Check size={13} weight="bold" />}
                          {t(z.name)}
                          {showPrices && (
                            <span style={{ opacity: 0.7, fontSize: 12.5 }} className="num">
                              {fmt(z.fee)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    {err('zone')}
                  </div>
                  <label className="field" data-field="address" style={{ marginTop: 14 }}>
                    <span>{pick('العنوان بالتفصيل', 'Full address')}</span>
                    <textarea className={'input' + (errors.address ? ' err' : '')} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" placeholder={pick('الشارع، رقم العمارة، الدور، الشقة، علامة مميزة', 'Street, building, floor, flat, landmark')} />
                    {err('address')}
                  </label>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 16, borderRadius: 18, background: 'var(--blush-panel)' }}>
                  <span className="tile-ic">
                    <Storefront size={24} />
                  </span>
                  <div>
                    <b style={{ fontWeight: 600 }}>{t(s.pickupAddress)}</b>
                    <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--ink-muted)' }}>{pick('هنبعتلك اللوكيشن والميعاد على واتساب بعد ما نأكد الطلب.', 'We’ll send you the location and time on WhatsApp once we confirm.')}</p>
                  </div>
                </div>
              )}
              <div className="grid-2" style={{ marginTop: 14 }}>
                <label className="field" data-field="date">
                  <span>{type === 'delivery' ? pick('يوم التوصيل', 'Delivery day') : pick('يوم الاستلام', 'Pick-up day')}</span>
                  <input type="date" className={'input' + (errors.date ? ' err' : '')} value={date} min={minDate} onChange={(e) => setDate(e.target.value)} />
                  {err('date') || (
                    <span style={{ fontSize: 12.5, color: 'var(--ink-muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <CalendarBlank size={14} />
                      {lead > 1 ? pick(`طلبك محتاج ${lead} أيام تحضير`, `Your order needs ${lead} days to prepare`) : pick('أقرب ميعاد بكرة', 'Earliest: tomorrow')}
                    </span>
                  )}
                </label>
                {s.timeSlots.length > 0 && (
                  <div className="field">
                    <span>{pick('الوقت المناسب', 'Preferred time')}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {s.timeSlots.map((sl) => (
                        <button type="button" key={sl.id} className={'chip-opt sm' + (slotId === sl.id ? ' on' : '')} style={{ justifyContent: 'flex-start', minHeight: 40 }} onClick={() => setSlotId(sl.id)} aria-pressed={slotId === sl.id}>
                          {slotId === sl.id && <Check size={13} weight="bold" />}
                          {t(sl.name)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 3 — payment */}
            <section className="card card-pad">
              <h2 className="card-title">
                <span className="step">3</span>
                {pick('طريقة الدفع', 'Payment')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} role="radiogroup">
                {methods.map((m) => {
                  const Ic = PayIc[m];
                  const sub =
                    m === 'cod'
                      ? pick(type === 'pickup' ? 'ادفع كاش وانت بتستلم' : 'ادفع كاش للمندوب', type === 'pickup' ? 'Pay cash when you collect' : 'Pay the courier in cash')
                      : m === 'instapay'
                        ? pick('حوّل على إنستاباي بعد ما نأكد الطلب', 'Transfer via InstaPay after we confirm')
                        : pick('فودافون كاش / أي محفظة بعد التأكيد', 'Vodafone Cash or any wallet after we confirm');
                  return (
                    <button type="button" key={m} role="radio" aria-checked={payment === m} className={'radio-card' + (payment === m ? ' on' : '')} onClick={() => setPayment(m)}>
                      <span className="dot" />
                      <span className="tile-ic" style={{ width: 42, height: 42, borderRadius: 14 }}>
                        <Ic size={22} />
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.4 }}>
                        <b style={{ fontWeight: 600 }}>{m === 'cod' ? pick('كاش عند الاستلام', 'Cash on delivery') : m === 'instapay' ? pick('إنستاباي', 'InstaPay') : pick('محفظة إلكترونية', 'Mobile wallet')}</b>
                        <span style={{ fontSize: 13, color: 'var(--ink-muted)' }}>{sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <label className="field" style={{ marginTop: 16 }}>
                <span>
                  {pick('ملاحظات', 'Notes')} <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>{pick('(اختياري)', '(optional)')}</span>
                </span>
                <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={pick('أي تفاصيل تحب نعرفها: ألوان الحفلة، حساسية من حاجة، صورة هتبعتها…', 'Anything we should know: party colours, allergies, a photo you’ll send…')} />
              </label>
              <div className="field" style={{ marginTop: 16 }}>
                <span>
                  {pick('صور من خيالك', 'Inspiration photos')} <span style={{ fontWeight: 400, color: 'var(--ink-faint)' }}>{pick('(اختياري)', '(optional)')}</span>
                </span>
                <span style={{ fontSize: 13, color: 'var(--ink-muted)', fontWeight: 400 }}>{pick('ارفع صورة التورتة أو الديكور اللي نفسك فيه — لحد ٤ صور.', 'Upload the cake or décor you have in mind — up to 4 photos.')}</span>
                <div className="ref-grid">
                  {refs.map((u) => (
                    <div key={u} className="ref-thumb">
                      <img className="cover" src={u} alt="" />
                      <button type="button" aria-label={pick('شيل الصورة', 'Remove photo')} onClick={() => setRefs((r) => r.filter((x) => x !== u))}>
                        <X size={13} weight="bold" />
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: uploading }).map((_, i) => (
                    <div key={'u' + i} className="ref-thumb loading" aria-busy="true" />
                  ))}
                  {refs.length + uploading < 4 && (
                    <button type="button" className="ref-add" onClick={() => fileRef.current?.click()}>
                      <ImageSquare size={24} />
                      <span>{pick('أضف صورة', 'Add photo')}</span>
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addRefs(e.target.files)} />
                {refMsg && <span className="err-text">{refMsg}</span>}
              </div>
            </section>
          </div>

          {/* summary */}
          <aside className="card card-pad" style={{ flex: '1 1 340px', minWidth: 0, position: 'sticky', top: 88 }}>
            <h2 className="card-title" style={{ justifyContent: 'space-between' }}>
              {pick('ملخّص الطلب', 'Order summary')}
              <span className="num" style={{ fontSize: 14, fontFamily: 'var(--f-plex)', color: 'var(--ink-muted)', fontWeight: 500 }}>
                {lines.reduce((a, l) => a + l.qty, 0)} {pick('قطعة', 'items')}
              </span>
            </h2>
            <div>
              {lines.map((l) => (
                <div key={l.key} className="line-item">
                  <span className="th">{l.image ? <img className="cover" src={l.image} alt="" /> : l.kind === 'custom' ? <CakeSwatch colour={l.colour} /> : <Cake size={28} weight="light" />}</span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="nm">{t(l.name)}</span>
                    {l.kind === 'custom' && (
                      <span className="sub">
                        {[l.design.message && `«${l.design.message}»`, data.settings.builder.flavours.find((f) => f.id === l.design.flavourId)?.name[lang]].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div className="stepper" style={{ height: 36 }}>
                        <button type="button" style={{ width: 28, height: 28 }} onClick={() => setQty(l.key, l.qty - 1)} aria-label="-">
                          {l.qty === 1 ? <Trash size={13} /> : <Minus size={12} weight="bold" />}
                        </button>
                        <span>{l.qty}</span>
                        <button type="button" className="plus" style={{ width: 28, height: 28 }} onClick={() => setQty(l.key, l.qty + 1)} aria-label="+">
                          <Plus size={12} weight="bold" />
                        </button>
                      </div>
                      {showPrices && <span className="price">{fmt(l.unitPrice * l.qty)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              {coupon ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 14, background: 'var(--blush-panel)', fontSize: 14 }}>
                  <Tag size={18} color="#8A5537" />
                  <b className="ltr" style={{ fontWeight: 600 }}>
                    {coupon.code}
                  </b>
                  <span style={{ color: 'var(--ink-muted)' }}>{coupon.type === 'percent' ? `-${coupon.value}%` : showPrices ? `-${fmt(coupon.value)}` : ''}</span>
                  <div className="spacer" />
                  <button type="button" onClick={() => setCoupon(null)} aria-label="remove" style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--ink-muted)', display: 'grid' }}>
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input ltr" style={{ height: 46, fontSize: 14.5, textTransform: 'uppercase' }} value={couponIn} onChange={(e) => setCouponIn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCoupon())} placeholder={pick('كود خصم', 'Promo code')} aria-label={pick('كود خصم', 'Promo code')} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={applyCoupon}>
                    {pick('تطبيق', 'Apply')}
                  </button>
                </div>
              )}
              {couponMsg && <span className="err-text">{couponMsg}</span>}
            </div>
            {!showPrices && (
              <p style={{ margin: '14px 0 0', fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-muted)', textAlign: 'center' }}>
                {pick('هنأكد معاك السعر النهائي والتوصيل على واتساب.', 'We will confirm the final price and delivery with you on WhatsApp.')}
              </p>
            )}
            <div className="totals" hidden={!showPrices}>
              <div className="r">
                <span>{pick('المجموع', 'Subtotal')}</span>
                <b>{fmt(subtotal)}</b>
              </div>
              <div className="r">
                <span>{type === 'delivery' ? pick('التوصيل', 'Delivery') + (zone ? ` · ${t(zone.name)}` : '') : pick('استلام من المطبخ', 'Pick-up')}</span>
                <b>{type === 'delivery' ? (zone ? fmt(fee) : '—') : pick('مجاناً', 'Free')}</b>
              </div>
              {discount > 0 && (
                <div className="r" style={{ color: '#6D8B4E' }}>
                  <span>{pick('الخصم', 'Discount')}</span>
                  <b style={{ color: '#5E7D40' }}>-{fmt(discount)}</b>
                </div>
              )}
              <div className="r grand">
                <span>{pick('الإجمالي', 'Total')}</span>
                <b>{fmt(total)}</b>
              </div>
            </div>
            {serverErr && (
              <div role="alert" style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: '#FBE4E0', color: '#8F3A2F', fontSize: 14 }}>
                {serverErr}
              </div>
            )}
            <button type="submit" className="btn btn-rose" data-burst="1" disabled={busy || uploading > 0 || !s.storeOpen} style={{ width: '100%', marginTop: 18 }} onPointerDown={(e) => burst(e.clientX, e.clientY, 8)}>
              <span data-sheen="3800" className="sheen" />
              {busy ? pick('بنبعت طلبك…', 'Placing your order…') : showPrices ? pick(`أكّد الطلب · ${fmt(total)}`, `Place order · ${fmt(total)}`) : pick('أكّد الطلب', 'Place order')}
            </button>
            <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--ink-muted)', display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <Lock size={14} />
              {pick('مش هتدفع حاجة دلوقتي — هنكلمك على واتساب نأكد التفاصيل.', 'Nothing is charged now — we’ll confirm the details with you on WhatsApp.')}
            </p>
          </aside>
        </form>
      </main>
    </div>
  );
}
