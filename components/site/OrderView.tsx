'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Cake, CheckCircle, ClockCountdown, Copy, CookingPot, Gift, HandHeart, Moped, Package, Receipt, Star, Storefront, WhatsappLogo, XCircle, Check } from '@phosphor-icons/react';
import type { PublicOrder } from '@/lib/orders';
import { fmtDate, PAYMENT_LABEL, STATUS_LABEL } from '@/lib/pricing';
import { useSite } from './SiteProvider';
import { CakeSwatch, MiniHeader } from './Checkout';
import { LogoRing } from './Hero';

const ICON: Record<string, React.ComponentType<{ size?: number; weight?: 'fill' | 'regular' | 'bold' }>> = {
  new: Receipt,
  confirmed: CheckCircle,
  preparing: CookingPot,
  ready: Package,
  out_for_delivery: Moped,
  delivered: Gift,
};

export function OrderView({ initial, isNew }: { initial: PublicOrder; isNew: boolean }) {
  const { t, pick, fmt, lang, wa, data, burst, toast, reduced, user, showPrices } = useSite();
  const [o, setO] = useState(initial);
  const discRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/orders/${o.id}`, { cache: 'no-store' });
        if (r.ok) setO(await r.json());
      } catch {}
    }, 20000);
    return () => clearInterval(id);
  }, [o.id]);

  useEffect(() => {
    if (!isNew) return;
    history.replaceState(null, '', `/order/${o.id}`);
    if (reduced) return;
    const d = discRef.current;
    const fire = () => {
      const r = d?.getBoundingClientRect();
      if (!r) return;
      burst(r.left + r.width / 2, r.top + r.height / 2, 28);
      setTimeout(() => burst(r.left + r.width * 0.2, r.top + r.height * 0.4, 16), 260);
      setTimeout(() => burst(r.left + r.width * 0.8, r.top + r.height * 0.4, 16), 420);
    };
    const tm = setTimeout(fire, 650);
    d?.animate([{ scale: '0.7', opacity: 0 }, { scale: '1', opacity: 1 }], { duration: 1200, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' });
    const ring = d?.querySelector('svg');
    const spin = ring?.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 60000, iterations: Infinity });
    return () => {
      clearTimeout(tm);
      spin?.cancel();
    };
  }, [isNew, o.id, burst, reduced]);

  const flow = (['new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'] as const).filter((s) => !(o.fulfillment.type === 'pickup' && s === 'out_for_delivery'));
  const cur = flow.indexOf(o.status as (typeof flow)[number]);
  const at = (s: string) => o.history.filter((h) => h.status === s).pop()?.at;
  const cancelled = o.status === 'cancelled';

  const msg =
    pick(`أهلاً Petalya! ده طلبي رقم ${o.code} من الموقع:\n`, `Hi Petalya! This is my order ${o.code} from the website:\n`) +
    o.items.map((i) => `• ${i.qty} × ${t(i.name)}`).join('\n') +
    (showPrices ? '\n' + pick('الإجمالي: ', 'Total: ') + fmt(o.total) : '');

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(pick('اتنسخ', 'Copied'));
    } catch {}
  };

  const pay = data.settings.payments;
  const priceKnown = showPrices || !!o.quote;
  const payHint = priceKnown && o.payment.status === 'unpaid' && o.payment.method !== 'cod' ? (o.payment.method === 'instapay' ? pay.instapay.handle : pay.wallet.number) : '';
  const slotName = o.fulfillment.slotName ? ' · ' + t(o.fulfillment.slotName) : '';

  return (
    <div className="page-bg">
      <MiniHeader />
      <main className="wrap" style={{ maxWidth: 1080, padding: 'clamp(24px,5vw,48px) clamp(16px,4vw,48px) 100px' }}>
        <div className="center">
          <div ref={discRef} style={{ position: 'relative', width: 168, height: 168, margin: '0 auto' }}>
            <LogoRing id="ord-ring" size={9} spacing={2.6} stroke={0.6} dotted={false} />
            <div style={{ position: 'absolute', inset: '12.5%', borderRadius: '50%', display: 'grid', placeItems: 'center', background: cancelled ? '#EFE3DE' : 'var(--cocoa)', color: cancelled ? 'var(--ink-muted)' : '#F2C6BD', boxShadow: '0 26px 44px -22px rgba(74,44,34,.55), 0 0 0 5px rgba(255,252,248,.8), 0 0 0 6px rgba(196,146,116,.35)' }}>
              {cancelled ? <XCircle size={56} /> : o.status === 'delivered' ? <HandHeart size={56} /> : <Check size={56} weight="bold" />}
            </div>
          </div>
          <div className="eyebrow" style={{ marginTop: 22 }}>
            <span className="ltr">{o.code}</span>
          </div>
          <h1 className="h2" style={{ fontSize: lang === 'ar' ? 'clamp(30px,7vw,50px)' : 'clamp(38px,8vw,62px)' }}>
            {cancelled ? (
              pick('الطلب ده اتلغى', 'This order was cancelled')
            ) : isNew ? (
              lang === 'ar' ? (
                <>
                  شكرًا يا {o.customer.name.split(' ')[0]}! <span className="accent">طلبك وصلنا</span>
                </>
              ) : (
                <>
                  Thank you, {o.customer.name.split(' ')[0]}! <em className="accent">We’ve got it</em>
                </>
              )
            ) : (
              t(STATUS_LABEL[o.status])
            )}
          </h1>
          <p className="intro">
            {cancelled
              ? pick('لو ده حصل بالغلط كلّمنا على واتساب وهنرتبها.', 'If this was a mistake, message us on WhatsApp and we’ll sort it out.')
              : pick('هنراجع التفاصيل ونأكدلك السعر هنا في الصفحة دي. الصفحة بتتحدّث لوحدها — احفظ اللينك عشان تتابع طلبك.', 'We’ll review the details and confirm your price right here. This page updates by itself — bookmark it to follow your order.')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 26 }} className="no-print">
            <button className="btn btn-rose" data-burst="1" onClick={() => copy(location.href)}>
              <span data-sheen="1" className="sheen" />
              <Copy size={19} />
              {pick('انسخ لينك المتابعة', 'Copy tracking link')}
            </button>
            <a href={wa(msg)} target="_blank" rel="noopener" className="btn btn-outline">
              <WhatsappLogo size={20} />
              {pick('عندك سؤال؟ كلّمنا على واتساب', 'Questions? Chat on WhatsApp')}
            </a>
          </div>
        </div>

        {!cancelled && !priceKnown && (
          <section className="card card-pad" style={{ marginTop: 'clamp(28px,5vw,44px)', textAlign: 'center' }}>
            <b style={{ fontWeight: 600 }}>{pick('بنجهّز سعر طلبك…', 'We’re preparing your price…')}</b>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--ink-muted)' }}>{pick('هيظهر هنا بمجرد ما نأكده، والصفحة بتتحدّث لوحدها.', 'It will appear here as soon as we confirm it — this page updates by itself.')}</p>
          </section>
        )}
        {!cancelled && o.quote && (
          <section className="card card-pad" style={{ marginTop: 'clamp(28px,5vw,44px)', textAlign: 'center', background: 'var(--blush-panel)' }}>
            <span className="field-label">{pick('السعر النهائي لطلبك', 'Your final price')}</span>
            <div className="num" style={{ fontSize: 'clamp(30px,6vw,42px)', fontWeight: 600, color: 'var(--cocoa)', lineHeight: 1.3 }}>{fmt(o.quote.total)}</div>
            {o.quote.note && <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--ink-muted)' }}>{o.quote.note}</p>}
            {o.payment.status === 'unpaid' && (
              <p style={{ margin: '10px 0 0', fontSize: 14 }}>
                {o.payment.method === 'cod' ? pick('هتدفع كاش عند الاستلام.', 'You’ll pay cash on receipt.') : pick('حوّل المبلغ على بيانات الدفع تحت، وابعتلنا صورة التحويل على واتساب.', 'Transfer to the payment details below, then send us the receipt on WhatsApp.')}
              </p>
            )}
          </section>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 'clamp(36px,6vw,56px)', alignItems: 'flex-start' }}>
          <section className="card card-pad" style={{ flex: '1 1 320px', minWidth: 0 }}>
            <h2 className="card-title">
              <ClockCountdown size={24} color="#B97E5E" />
              {pick('حالة الطلب', 'Order status')}
            </h2>
            {cancelled ? (
              <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{pick('الطلب اتلغى في ', 'Cancelled on ') + fmtDate(at('cancelled') || o.updatedAt, lang, { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })}</p>
            ) : (
              <div className="timeline">
                {flow.map((s, i) => {
                  const Ic = ICON[s];
                  const done = i < cur || (i === cur && s === 'delivered');
                  const current = i === cur && s !== 'delivered';
                  const when = at(s);
                  return (
                    <div key={s} className={'tl-step' + (i <= cur ? ' done' : '') + (current ? ' current' : '')}>
                      <span className="ic">{done ? <Check size={18} weight="bold" /> : <Ic size={19} />}</span>
                      <span className="tx">
                        <b style={{ opacity: i <= cur ? 1 : 0.55 }}>{t(STATUS_LABEL[s])}</b>
                        {when && i <= cur && <span className="num">{fmtDate(when, lang, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card card-pad" style={{ flex: '1.4 1 380px', minWidth: 0 }}>
            <h2 className="card-title">
              <Receipt size={24} color="#B97E5E" />
              {pick('تفاصيل الطلب', 'Order details')}
            </h2>
            {o.items.map((it, i) => (
              <div key={i} className="line-item" style={{ alignItems: 'flex-start' }}>
                <span className="th">{it.image ? <img className="cover" src={it.image} alt="" /> : it.kind === 'custom' ? <CakeSwatch colour={it.colour} /> : <Cake size={28} weight="light" />}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <span className="nm">
                      {it.qty} × {t(it.name)}
                    </span>
                    {showPrices && <span className="price">{fmt(it.unitPrice * it.qty)}</span>}
                  </div>
                  {it.summary && (
                    <div className="sub" style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px' }}>
                      {it.summary
                        .filter((r) => t(r.v) !== '—')
                        .map((r) => (
                          <span key={r.k.en} style={{ display: 'contents' }}>
                            <span>{t(r.k)}</span>
                            <span style={{ color: 'var(--cocoa)' }}>{t(r.v)}</span>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="totals" hidden={!showPrices}>
              <div className="r">
                <span>{pick('المجموع', 'Subtotal')}</span>
                <b>{fmt(o.subtotal)}</b>
              </div>
              <div className="r">
                <span>{o.fulfillment.type === 'delivery' ? pick('التوصيل', 'Delivery') : pick('استلام', 'Pick-up')}</span>
                <b>{o.deliveryFee ? fmt(o.deliveryFee) : pick('مجاناً', 'Free')}</b>
              </div>
              {o.discount > 0 && (
                <div className="r">
                  <span>
                    {pick('الخصم', 'Discount')} <span className="ltr">{o.couponCode}</span>
                  </span>
                  <b>-{fmt(o.discount)}</b>
                </div>
              )}
              <div className="r grand">
                <span>{pick('الإجمالي', 'Total')}</span>
                <b>{fmt(o.total)}</b>
              </div>
            </div>
            {!!o.refImages?.length && (
              <div style={{ marginTop: 18 }}>
                <span className="field-label">{pick('صورك اللي بعتّها', 'Your inspiration photos')}</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {o.refImages.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noopener" style={{ width: 72, height: 72, borderRadius: 14, overflow: 'hidden', display: 'block', background: 'var(--blush-tile)' }}>
                      <img className="cover" src={u} alt="" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="grid-2" style={{ marginTop: 18 }}>
              <div className="summary-box">
                <span className="field-label" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {o.fulfillment.type === 'delivery' ? <Moped size={16} /> : <Storefront size={16} />}
                  {o.fulfillment.type === 'delivery' ? pick('التوصيل', 'Delivery') : pick('الاستلام', 'Pick-up')}
                </span>
                <b style={{ fontWeight: 600 }}>{fmtDate(o.fulfillment.date, lang, { weekday: 'long', day: 'numeric', month: 'long' }) + slotName}</b>
                <span style={{ fontSize: 13.5, color: 'var(--ink-muted)' }}>{o.fulfillment.type === 'delivery' ? `${t(o.fulfillment.zoneName)} — ${o.fulfillment.address}` : t(data.settings.pickupAddress)}</span>
              </div>
              <div className="summary-box">
                <span className="field-label">{pick('الدفع', 'Payment')}</span>
                <b style={{ fontWeight: 600 }}>{t(PAYMENT_LABEL[o.payment.method])}</b>
                <span style={{ fontSize: 13.5, color: o.payment.status === 'paid' ? '#5E7D40' : 'var(--ink-muted)' }}>{o.payment.status === 'paid' ? pick('اتدفع ✓', 'Paid ✓') : pick('لسه مدفعش', 'Not paid yet')}</span>
                {payHint && (
                  <button onClick={() => copy(payHint)} style={{ marginTop: 4, display: 'inline-flex', gap: 6, alignItems: 'center', alignSelf: 'flex-start', border: '1px dashed var(--copper-line)', background: 'var(--paper)', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontSize: 13.5, color: 'var(--cocoa)' }}>
                    <span className="ltr num">{payHint}</span>
                    <Copy size={14} />
                  </button>
                )}
                {payHint && <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{pick('بعد التحويل ابعتلنا صورة التحويل على واتساب.', 'After transferring, send us the receipt on WhatsApp.')}</span>}
              </div>
            </div>
          </section>
        </div>

        {o.status === 'delivered' && <ReviewForm orderId={o.id} />}

        <p className="center no-print" style={{ marginTop: 34, fontSize: 14 }}>
          <Link href="/">{pick('ارجع للموقع', 'Back to the site')}</Link>
          {user && (
            <>
              {' · '}
              <Link href="/account">{pick('كل طلباتي', 'All my orders')}</Link>
            </>
          )}
        </p>
      </main>
    </div>
  );
}

function ReviewForm({ orderId }: { orderId: string }) {
  const { pick, burst } = useSite();
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'exists'>('idle');
  const send = async (e: React.MouseEvent) => {
    if (quote.trim().length < 4) return;
    setState('busy');
    const r = await fetch('/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId, rating, quote }) });
    if (r.ok) {
      burst(e.clientX, e.clientY, 20);
      setState('done');
    } else setState(r.status === 409 ? 'exists' : 'idle');
  };
  return (
    <section className="card card-pad" style={{ marginTop: 18, textAlign: 'center' }}>
      <h2 className="card-title" style={{ justifyContent: 'center' }}>
        {pick('عجبتك؟ قولنا رأيك', 'Did you love it? Tell us')}
      </h2>
      {state === 'done' || state === 'exists' ? (
        <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{pick('شكرًا من قلبنا! رأيك وصلنا 🤍', 'Thank you so much — we got your review 🤍')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, color: '#C08A5E' }} className="ltr">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n}`} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit', padding: 2 }}>
                <Star size={32} weight={n <= rating ? 'fill' : 'regular'} />
              </button>
            ))}
          </div>
          <textarea className="input" rows={3} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder={pick('التورتة كانت…', 'The cake was…')} maxLength={400} />
          <button className="btn btn-flat btn-md" onClick={send} disabled={state === 'busy' || quote.trim().length < 4} style={{ alignSelf: 'center' }}>
            {pick('ابعت رأيك', 'Send review')}
          </button>
        </div>
      )}
    </section>
  );
}
