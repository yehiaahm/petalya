'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Cake, Check, CheckCircle, CookingPot, Copy, Gift, MapPin, Moped, Package, Phone, Printer, Receipt, Storefront, Trash, WhatsappLogo, XCircle } from '@phosphor-icons/react';
import type { Order, OrderStatus } from '@/lib/types';
import { PAYMENT_LABEL, phoneToWa, STATUS_LABEL, waLink } from '@/lib/pricing';
import { api, dayLabel, egp, relTime, StatusPill, Toggle, useAdmin, useConfirm } from './ui';
import { CakeSwatch } from '@/components/site/Checkout';
import { arCount } from '@/lib/ar';

const ICON: Record<string, React.ComponentType<{ size?: number }>> = { new: Receipt, confirmed: CheckCircle, preparing: CookingPot, ready: Package, out_for_delivery: Moped, delivered: Gift };

const NEXT_LABEL: Record<string, string> = {
  new: 'تأكيد الطلب',
  confirmed: 'بدء التحضير',
  preparing: 'الطلب جاهز',
  ready: 'خرج للتوصيل',
  out_for_delivery: 'تم التسليم',
};

function customerMessage(o: Order, status: OrderStatus, trackUrl: string, pay: { instapay: string; wallet: string }) {
  const first = o.customer.name.split(' ')[0];
  const en = o.lang === 'en';
  const priceLine = o.quote
    ? en
      ? `\nFinal price: ${o.quote.total.toLocaleString('en-US')} EGP${o.quote.note ? ` (${o.quote.note})` : ''}.`
      : `\nالسعر النهائي: ${o.quote.total.toLocaleString('en-US')} ج.م${o.quote.note ? ` (${o.quote.note})` : ''}.`
    : '';
  const payLine =
    o.payment.status === 'unpaid' && o.payment.method !== 'cod'
      ? en
        ? `\nPlease transfer ${o.total.toLocaleString('en-US')} EGP to ${o.payment.method === 'instapay' ? pay.instapay : pay.wallet} and send us the receipt.`
        : `\nبرجاء تحويل ${o.total.toLocaleString('en-US')} ج.م على ${o.payment.method === 'instapay' ? 'إنستاباي ' + pay.instapay : 'المحفظة ' + pay.wallet}، ثم إرسال صورة إيصال التحويل هنا.`
      : '';
  const m: Record<string, [string, string]> = {
    new: [`أهلًا ${first}! استلمنا طلبك ${o.code} 🤍 سنراجعه ونؤكده لك خلال وقت قصير.`, `Hi ${first}! We received your order ${o.code} 🤍 We'll confirm shortly.`],
    confirmed: [`أهلًا ${first}! تم تأكيد طلبك ${o.code} ✨ موعده ${dayLabel(o.fulfillment.date, { weekday: 'long', day: 'numeric', month: 'long' })}.${priceLine}${payLine}`, `Hi ${first}! Your order ${o.code} is confirmed ✨ See you on ${new Date(o.fulfillment.date + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.${priceLine}${payLine}`],
    preparing: [`طلبك ${o.code} قيد التحضير الآن في مطبخنا 🎂`, `Your order ${o.code} is being made in our kitchen right now 🎂`],
    ready: [o.fulfillment.type === 'pickup' ? `طلبك ${o.code} جاهز للاستلام 🎉` : `طلبك ${o.code} جاهز، وسيخرج للتوصيل قريبًا 🎉`, o.fulfillment.type === 'pickup' ? `Your order ${o.code} is ready for pick-up 🎉` : `Your order ${o.code} is ready and will be out for delivery soon 🎉`],
    out_for_delivery: [`طلبك ${o.code} في الطريق إليك 🛵`, `Your order ${o.code} is on its way 🛵`],
    delivered: [`نتمنى أن يكون طلبك قد نال إعجابك يا ${first} 🤍 يسعدنا أن تشاركنا رأيك:`, `We hope you loved it, ${first} 🤍 If you have a minute, tell us what you think:`],
    cancelled: [`أهلًا ${first}، نأسف لإبلاغك بأنه تم إلغاء طلبك ${o.code}. نحن هنا لأي استفسار.`, `Hi ${first}, unfortunately your order ${o.code} was cancelled. We're here if you have any questions.`],
  };
  return (en ? m[status][1] : m[status][0]) + `\n${trackUrl}`;
}

export function OrderDetail({ order, pay }: { order: Order; pay: { instapay: string; wallet: string } }) {
  const router = useRouter();
  const { toast } = useAdmin();
  const confirm = useConfirm();
  const [o, setO] = useState(order);
  const [notes, setNotes] = useState(order.adminNotes || '');
  const [price, setPrice] = useState(String(order.quote?.total ?? order.total));
  const [priceNote, setPriceNote] = useState(order.quote?.note || '');
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(location.origin);
    if (!order.seen) api(`/api/admin/orders/${order.id}`, 'PATCH', { seen: true }).then(() => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = async (body: Record<string, unknown>, msg?: string) => {
    setBusy(true);
    try {
      const n = await api<Order>(`/api/admin/orders/${o.id}`, 'PATCH', body);
      setO(n);
      if (msg) toast(msg);
      router.refresh();
    } catch {
      toast('حدث خطأ، حاول مرة أخرى', true);
    }
    setBusy(false);
  };

  const flow: OrderStatus[] = (['new', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'] as OrderStatus[]).filter((s) => !(o.fulfillment.type === 'pickup' && s === 'out_for_delivery'));
  const cur = flow.indexOf(o.status);
  const next = cur >= 0 && cur < flow.length - 1 ? flow[cur + 1] : null;
  const trackUrl = `${origin}/order/${o.id}`;
  const waCustomer = (s: OrderStatus) => waLink(phoneToWa(o.customer.phone), customerMessage(o, s, trackUrl, pay));
  const at = (s: string) => o.history.filter((h) => h.status === s).pop()?.at;

  const setStatus = async (s: OrderStatus) => {
    if (s === 'cancelled' && !(await confirm.ask('إلغاء الطلب؟', `سيُلغى الطلب ${o.code}، وسيظهر ذلك للعميل في صفحة متابعة الطلب.`, 'إلغاء الطلب'))) return;
    await patch({ status: s }, `تم تغيير حالة الطلب إلى «${STATUS_LABEL[s].ar}»`);
  };
  const del = async () => {
    if (!(await confirm.ask('حذف الطلب نهائيًا؟', 'لا يمكن التراجع عن الحذف. للاحتفاظ بسجل الطلب، استخدم «إلغاء الطلب» بدلًا من الحذف.'))) return;
    await api(`/api/admin/orders/${o.id}`, 'DELETE');
    toast('تم حذف الطلب');
    router.push('/admin/orders');
    router.refresh();
  };
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast('تم النسخ'));

  return (
    <>
      {confirm.node}
      <div className="a-ph">
        <div>
          <Link href="/admin/orders" className="small no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowRight size={14} /> كل الطلبات
          </Link>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
            <span className="ltr num">{o.code}</span>
            <StatusPill s={o.status} />
            {o.demo && <span className="pill plain st-cancelled">تجريبي</span>}
            {o.userId && <span className="pill plain st-confirmed">عميل لديه حساب</span>}
          </h1>
          <p>
            أُنشئ {relTime(o.createdAt)} · {new Date(o.createdAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="acts no-print">
          <button className="ab ghost" onClick={() => window.print()}>
            <Printer size={18} />
            طباعة
          </button>
          <a href={`/order/${o.id}`} target="_blank" rel="noopener" className="ab ghost">
            صفحة العميل
          </a>
        </div>
      </div>

      {o.status !== 'cancelled' ? (
        <div className="a-card a-pad no-print" style={{ marginBottom: 16 }}>
          <div className="steps-h">
            {flow.map((s, i) => {
              const Ic = ICON[s];
              const done = i < cur || (i === cur && s === 'delivered');
              return (
                <button key={s} className={'s' + (i <= cur ? ' done' : '') + (i === cur && s !== 'delivered' ? ' cur' : '')} style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => i !== cur && setStatus(s)} disabled={busy} title={`تغيير الحالة إلى «${STATUS_LABEL[s].ar}»`}>
                  <span className="c">{done ? <Check size={18} weight="bold" /> : <Ic size={19} />}</span>
                  {STATUS_LABEL[s].ar}
                  {at(s) && i <= cur && <span className="faint" style={{ fontSize: 11, fontWeight: 400 }}>{relTime(at(s)!)}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16, alignItems: 'center' }}>
            {next && (
              <button className="ab primary" onClick={() => setStatus(next)} disabled={busy} style={{ height: 46, paddingInline: 22 }}>
                {NEXT_LABEL[o.status]}
                <ArrowRight size={16} style={{ transform: 'scaleX(-1)' }} />
              </button>
            )}
            <a href={waCustomer(o.status)} target="_blank" rel="noopener" className="ab wa" style={{ height: 46 }}>
              <WhatsappLogo size={19} />
              إرسال تحديث للعميل
            </a>
            <div style={{ flex: 1 }} />
            <button className="ab danger sm" onClick={() => setStatus('cancelled')} disabled={busy}>
              <XCircle size={16} />
              إلغاء الطلب
            </button>
          </div>
        </div>
      ) : (
        <div className="a-card a-pad no-print" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#F4EEEA' }}>
          <XCircle size={24} color="#7A6A62" />
          <b>تم إلغاء هذا الطلب</b>
          <div style={{ flex: 1 }} />
          <button className="ab ghost sm" onClick={() => patch({ status: 'new' }, 'تمت استعادة الطلب')}>
            استعادة الطلب
          </button>
          <a href={waCustomer('cancelled')} target="_blank" rel="noopener" className="ab wa sm">
            <WhatsappLogo size={16} /> إبلاغ العميل
          </a>
        </div>
      )}

      <div className="a-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', alignItems: 'start' }}>
        <div className="a-grid">
          <div className="a-card">
            <div className="hd">
              <h2>المنتجات</h2>
              <span className="sub">{arCount(o.items.reduce((a, i) => a + i.qty, 0), 'item')}</span>
            </div>
            <div className="a-pad" style={{ paddingTop: 8 }}>
              {o.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < o.items.length - 1 ? '1px solid var(--line)' : 0, alignItems: 'flex-start' }}>
                  <span className="thumb-sm" style={{ width: 60, height: 60, borderRadius: 14 }}>
                    {it.image ? <img src={it.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : it.kind === 'custom' ? <CakeSwatch colour={it.colour} size={60} /> : <Cake size={24} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <b style={{ fontWeight: 600 }}>
                        <span className="num" style={{ color: 'var(--copper-text)' }}>{it.qty}×</span> {it.name.ar}
                      </b>
                      <b className="num" style={{ fontWeight: 600 }}>{egp(it.unitPrice * it.qty)}</b>
                    </div>
                    {it.qty > 1 && <div className="faint small">{egp(it.unitPrice)} للقطعة</div>}
                    {it.summary && (
                      <div className="kv" style={{ marginTop: 10, padding: 12, borderRadius: 14, background: 'var(--blush-panel)', fontSize: 13 }}>
                        {it.summary.map((r) => (
                          <span key={r.k.en} style={{ display: 'contents' }}>
                            <span>{r.k.ar}</span>
                            <span style={{ fontWeight: r.k.en === 'Message' ? 700 : 500 }}>{r.v.ar}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="kv" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed rgba(185,126,94,.4)' }}>
                <span>المجموع الفرعي</span>
                <span className="num" style={{ textAlign: 'end' }}>{egp(o.subtotal)}</span>
                <span>التوصيل</span>
                <span className="num" style={{ textAlign: 'end' }}>{o.deliveryFee ? egp(o.deliveryFee) : 'مجانًا'}</span>
                {o.discount > 0 && (
                  <>
                    <span>
                      خصم <span className="ltr">{o.couponCode}</span>
                    </span>
                    <span className="num" style={{ textAlign: 'end', color: 'var(--ok)' }}>-{egp(o.discount)}</span>
                  </>
                )}
                <b style={{ fontSize: 16 }}>الإجمالي</b>
                <b className="num" style={{ textAlign: 'end', fontSize: 18 }}>{egp(o.total)}</b>
              </div>
            </div>
          </div>

          {o.notes && (
            <div className="a-card a-pad" style={{ background: '#FFF6E6', borderColor: 'rgba(217,163,74,.35)' }}>
              <b style={{ display: 'block', marginBottom: 4 }}>ملاحظات العميل</b>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{o.notes}</p>
            </div>
          )}

          {!!o.refImages?.length && (
            <div className="a-card a-pad">
              <b style={{ display: 'block', marginBottom: 10 }}>صور أرسلها العميل ({o.refImages.length})</b>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {o.refImages.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noopener" style={{ display: 'block', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', background: 'var(--blush-panel)' }}>
                    <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="a-grid">
          <div className="a-card a-pad no-print" style={o.quote ? undefined : { background: '#FFF6E6', borderColor: 'rgba(217,163,74,.35)' }}>
            <b style={{ display: 'block', marginBottom: 4 }}>{o.quote ? 'السعر الظاهر للعميل ✓' : 'السعر النهائي — العميل بانتظاره'}</b>
            <p className="small faint" style={{ margin: '0 0 10px' }}>
              لا يرى العميل أي سعر في الموقع إلا السعر الذي تؤكده هنا. بمجرد التأكيد تتحول حالة الطلب إلى «تم التأكيد»، ويظهر السعر وطريقة الدفع في صفحة المتابعة.
            </p>
            <div className="af">
              <span>السعر النهائي (ج.م) — شامل التوصيل</span>
              <input className="ai ltr num" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder={String(o.total)} />
            </div>
            <div className="af" style={{ marginTop: 10 }}>
              <span>رسالة للعميل (اختياري)</span>
              <input className="ai" value={priceNote} maxLength={300} onChange={(e) => setPriceNote(e.target.value)} placeholder="مثلًا: السعر يشمل التوبر والتوصيل" />
            </div>
            <button
              className="ab primary sm"
              style={{ marginTop: 12 }}
              disabled={busy || !price || (!!o.quote && Number(price) === o.quote.total && priceNote === (o.quote.note || ''))}
              onClick={() => patch({ quote: { total: Number(price), note: priceNote } }, 'تم تأكيد السعر وأصبح ظاهرًا للعميل')}
            >
              <Check size={16} /> {o.quote ? 'تحديث السعر' : 'تأكيد السعر وإرساله للعميل'}
            </button>
          </div>

          <div className="a-card a-pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="av" style={{ width: 48, height: 48, fontSize: 19 }}>{o.customer.name.charAt(0)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 16 }}>{o.customer.name}</b>
                <div className="muted ltr num" style={{ textAlign: 'right' }}>{o.customer.phone}</div>
                {o.customer.email && <div className="faint small ltr" style={{ textAlign: 'right' }}>{o.customer.email}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }} className="no-print">
              <a href={waCustomer(o.status)} target="_blank" rel="noopener" className="ab wa sm" style={{ flex: 1 }}>
                <WhatsappLogo size={16} /> واتساب
              </a>
              <a href={`tel:${o.customer.phone}`} className="ab ghost sm" style={{ flex: 1 }}>
                <Phone size={16} /> اتصال
              </a>
              <Link href={`/admin/orders?phone=${o.customer.phone}`} className="ab ghost sm" style={{ flex: 1 }}>
                طلباته
              </Link>
            </div>
          </div>

          <div className="a-card a-pad">
            <b style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {o.fulfillment.type === 'delivery' ? <Moped size={20} color="#B97E5E" /> : <Storefront size={20} color="#B97E5E" />}
              {o.fulfillment.type === 'delivery' ? 'توصيل' : 'استلام من المطبخ'}
            </b>
            <div className="kv">
              <span>اليوم</span>
              <b style={{ fontWeight: 600 }}>{dayLabel(o.fulfillment.date, { weekday: 'long', day: 'numeric', month: 'long' })}</b>
              {o.fulfillment.slotName && (
                <>
                  <span>الوقت</span>
                  <span>{o.fulfillment.slotName.ar}</span>
                </>
              )}
              {o.fulfillment.type === 'delivery' && (
                <>
                  <span>المنطقة</span>
                  <span>{o.fulfillment.zoneName?.ar}</span>
                  <span>العنوان</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                    <span style={{ flex: 1 }}>{o.fulfillment.address}</span>
                    <button className="ab ghost sm icon no-print" onClick={() => copy(`${o.fulfillment.zoneName?.ar} — ${o.fulfillment.address}\n${o.customer.name} ${o.customer.phone}`)} aria-label="نسخ العنوان للمندوب" title="نسخ للمندوب">
                      <Copy size={14} />
                    </button>
                    <a className="ab ghost sm icon no-print" target="_blank" rel="noopener" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((o.fulfillment.address || '') + ' ' + (o.fulfillment.zoneName?.ar || ''))}`} aria-label="فتح في الخرائط" title="الخرائط">
                      <MapPin size={14} />
                    </a>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="a-card a-pad">
            <div className="tgl-row" style={{ paddingTop: 0 }}>
              <div>
                <b>{PAYMENT_LABEL[o.payment.method].ar}</b>
                <small>{o.payment.status === 'paid' ? 'تم الدفع ✓' : 'لم يُدفع بعد'}</small>
              </div>
              <Toggle on={o.payment.status === 'paid'} onChange={(v) => patch({ paid: v }, v ? 'تم تسجيل الطلب كمدفوع' : 'تم تسجيل الطلب كغير مدفوع')} label="مدفوع" />
            </div>
            <div className="af" style={{ marginTop: 12 }}>
              <span>ملاحظات داخلية (لا تظهر للعميل)</span>
              <textarea className="ai" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثلًا: سيرسل العميل صورة للتوبر…" />
              {notes !== (o.adminNotes || '') && (
                <button className="ab primary sm" style={{ alignSelf: 'flex-start' }} onClick={() => patch({ adminNotes: notes }, 'تم حفظ الملاحظات')}>
                  حفظ الملاحظات
                </button>
              )}
            </div>
          </div>

          <div className="a-card a-pad">
            <b style={{ display: 'block', marginBottom: 12 }}>سجل الطلب</b>
            <div className="hist">
              {[...o.history].reverse().map((h, i) => (
                <div key={i} className="h">
                  <i style={i === 0 ? { background: 'var(--cocoa)' } : undefined} />
                  <div>
                    <b style={{ fontWeight: 600 }}>{STATUS_LABEL[h.status].ar}</b>
                    <div className="faint small">{new Date(h.at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    {h.note && <div className="small">{h.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="ab danger sm no-print" style={{ justifySelf: 'start' }} onClick={del}>
            <Trash size={15} /> حذف الطلب نهائيًا
          </button>
        </div>
      </div>
    </>
  );
}
