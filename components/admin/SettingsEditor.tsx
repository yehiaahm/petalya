'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Cake, CreditCard, DownloadSimple, FloppyDisk, Lock, Moped, Plus, Sparkle, Storefront, Trash } from '@phosphor-icons/react';
import type { Settings } from '@/lib/types';
import { api, BiInput, Field, NumInput, PageHeader, Toggle, useAdmin, useConfirm } from './ui';

const TABS = [
  { k: 'store', label: 'المتجر', icon: Storefront },
  { k: 'delivery', label: 'التوصيل والاستلام', icon: Moped },
  { k: 'payment', label: 'الدفع', icon: CreditCard },
  { k: 'builder', label: 'أسعار «صمّم تورتتك»', icon: Cake },
  { k: 'security', label: 'الأمان والبيانات', icon: Lock },
] as const;

export function SettingsEditor({ settings, hasDemo }: { settings: Settings; hasDemo: boolean }) {
  const router = useRouter();
  const { toast } = useAdmin();
  const confirm = useConfirm();
  const [s, setS] = useState(settings);
  const [tab, setTab] = useState<(typeof TABS)[number]['k']>('store');
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const up = (patch: Partial<Settings>) => setS((x) => ({ ...x, ...patch }));
  const b = s.builder;
  const upB = (patch: Partial<Settings['builder']>) => up({ builder: { ...b, ...patch } });

  const save = async () => {
    setBusy(true);
    try {
      setS(await api<Settings>('/api/admin/settings', 'PUT', s));
      toast('اتحفظت الإعدادات');
      router.refresh();
    } catch {
      toast('مقدرناش نحفظ', true);
    }
    setBusy(false);
  };

  return (
    <>
      {confirm.node}
      <PageHeader title="الإعدادات" sub="كل اللي بيتحكم في الموقع وطريقة الطلب">
        <button className="ab primary" onClick={save} disabled={!dirty || busy}>
          <FloppyDisk size={18} />
          {busy ? 'بنحفظ…' : dirty ? 'حفظ التغييرات' : 'محفوظ'}
        </button>
      </PageHeader>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <nav className="a-card set-nav" aria-label="أقسام الإعدادات">
          {TABS.map((t) => {
            const Ic = t.icon;
            return (
              <button key={t.k} onClick={() => setTab(t.k)} className={'ab' + (tab === t.k ? ' on' : '')} aria-current={tab === t.k ? 'page' : undefined}>
                <Ic size={19} weight={tab === t.k ? 'fill' : 'regular'} />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="a-grid" style={{ flex: '1 1 480px', minWidth: 0 }}>
          {tab === 'store' && (
            <>
              <div className="a-card a-pad">
                <div className="tgl-row" style={{ paddingTop: 0 }}>
                  <div>
                    <b>استقبال الطلبات</b>
                    <small>اقفله في الإجازات — الموقع هيفضل شغال بس مش هيقبل طلبات</small>
                  </div>
                  <Toggle on={s.storeOpen} onChange={(v) => up({ storeOpen: v })} />
                </div>
                {!s.storeOpen && <BiInput label="الرسالة اللي هتظهر للعملاء" value={s.closedMessage} onChange={(v) => up({ closedMessage: v })} max={200} />}
              </div>
              <div className="a-card a-pad">
                <div className="tgl-row" style={{ paddingTop: 0 }}>
                  <div>
                    <b>إظهار الأسعار في الموقع</b>
                    <small>لو مقفول، الموقع مش بيعرض أي سعر (المنيو، التصميم، السلة، الطلب) والسعر بيتحدد على واتساب</small>
                  </div>
                  <Toggle on={s.showPrices} onChange={(v) => up({ showPrices: v })} />
                </div>
              </div>
              <div className="a-card a-pad a-grid">
                <div className="ai-row">
                  <Field label="رقم واتساب (بالكود الدولي)" hint="مثلاً 201012345678 — كل أزرار واتساب في الموقع بتروح له">
                    <input className="ai ltr num" value={s.whatsapp} onChange={(e) => up({ whatsapp: e.target.value })} />
                  </Field>
                  <Field label="حساب إنستجرام">
                    <input className="ai ltr" value={s.instagramHandle} onChange={(e) => up({ instagramHandle: e.target.value })} />
                  </Field>
                </div>
                <Field label="لينك إنستجرام">
                  <input className="ai ltr" value={s.instagramUrl} onChange={(e) => up({ instagramUrl: e.target.value })} />
                </Field>
              </div>
              <div className="a-card a-pad ai-row">
                <Field label="أيام التحضير للتورت المخصوصة" hint="أقرب ميعاد يقدر العميل يختاره لما يصمّم تورتة">
                  <NumInput value={s.leadDays} onChange={(n) => up({ leadDays: n })} suffix="يوم" />
                </Field>
                <Field label="أيام التحضير لباقي المنتجات" hint="ممكن تغيّرها لكل منتج لوحده من صفحة المنتج">
                  <NumInput value={s.standardLeadDays} onChange={(n) => up({ standardLeadDays: n })} suffix="يوم" />
                </Field>
              </div>
            </>
          )}

          {tab === 'delivery' && (
            <>
              <div className="a-card a-pad">
                <div className="tgl-row" style={{ paddingTop: 0 }}>
                  <div>
                    <b>توصيل للبيت</b>
                    <small>العميل يختار منطقته والتكلفة بتتحسب تلقائي</small>
                  </div>
                  <Toggle on={s.deliveryEnabled} onChange={(v) => up({ deliveryEnabled: v || !s.pickupEnabled ? v : true })} />
                </div>
                <div className="tgl-row">
                  <div>
                    <b>استلام من المطبخ</b>
                    <small>من غير مصاريف توصيل</small>
                  </div>
                  <Toggle on={s.pickupEnabled} onChange={(v) => up({ pickupEnabled: v || !s.deliveryEnabled ? v : true })} />
                </div>
                {s.pickupEnabled && <BiInput label="مكان الاستلام" value={s.pickupAddress} onChange={(v) => up({ pickupAddress: v })} max={200} />}
              </div>
              <div className="a-card a-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <b>مناطق التوصيل والأسعار</b>
                  <button className="ab soft sm" onClick={() => up({ zones: [...s.zones, { id: 'z-' + Date.now().toString(36), name: { ar: '', en: '' }, fee: 60, active: true }] })}>
                    <Plus size={15} /> منطقة
                  </button>
                </div>
                <div className="sortable">
                  {s.zones.map((z, i) => (
                    <div key={z.id} className="sort-row" style={{ flexWrap: 'wrap', opacity: z.active ? 1 : 0.6 }}>
                      <div style={{ flex: '1 1 280px' }}>
                        <BiInput label="" value={z.name} onChange={(v) => up({ zones: s.zones.map((x, k) => (k === i ? { ...x, name: v } : x)) })} max={60} />
                      </div>
                      <div style={{ width: 130 }}>
                        <NumInput value={z.fee} onChange={(n) => up({ zones: s.zones.map((x, k) => (k === i ? { ...x, fee: n } : x)) })} suffix="ج.م" />
                      </div>
                      <Toggle on={z.active} onChange={(v) => up({ zones: s.zones.map((x, k) => (k === i ? { ...x, active: v } : x)) })} label="متاحة" />
                      <button className="ab danger sm icon" onClick={() => up({ zones: s.zones.filter((_, k) => k !== i) })} aria-label="حذف">
                        <Trash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="a-card a-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <b>مواعيد التسليم</b>
                  <button className="ab soft sm" onClick={() => up({ timeSlots: [...s.timeSlots, { id: 't-' + Date.now().toString(36), name: { ar: '', en: '' } }] })}>
                    <Plus size={15} /> ميعاد
                  </button>
                </div>
                <div className="sortable">
                  {s.timeSlots.map((t, i) => (
                    <div key={t.id} className="sort-row">
                      <div style={{ flex: 1 }}>
                        <BiInput label="" value={t.name} onChange={(v) => up({ timeSlots: s.timeSlots.map((x, k) => (k === i ? { ...x, name: v } : x)) })} max={60} />
                      </div>
                      <button className="ab danger sm icon" onClick={() => up({ timeSlots: s.timeSlots.filter((_, k) => k !== i) })} aria-label="حذف">
                        <Trash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'payment' && (
            <div className="a-card a-pad">
              <div className="tgl-row" style={{ paddingTop: 0 }}>
                <div>
                  <b>كاش عند الاستلام</b>
                  <small>العميل يدفع للمندوب أو وهو بيستلم</small>
                </div>
                <Toggle on={s.payments.cod.enabled} onChange={(v) => up({ payments: { ...s.payments, cod: { enabled: v } } })} />
              </div>
              <div className="tgl-row">
                <div>
                  <b>إنستاباي</b>
                  <small>العنوان بيظهر للعميل في صفحة الطلب عشان يحوّل</small>
                </div>
                <Toggle on={s.payments.instapay.enabled} onChange={(v) => up({ payments: { ...s.payments, instapay: { ...s.payments.instapay, enabled: v } } })} />
              </div>
              {s.payments.instapay.enabled && (
                <Field label="عنوان إنستاباي">
                  <input className="ai ltr" value={s.payments.instapay.handle} onChange={(e) => up({ payments: { ...s.payments, instapay: { ...s.payments.instapay, handle: e.target.value } } })} placeholder="name@instapay" />
                </Field>
              )}
              <div className="tgl-row">
                <div>
                  <b>محفظة إلكترونية</b>
                  <small>فودافون كاش أو أي محفظة</small>
                </div>
                <Toggle on={s.payments.wallet.enabled} onChange={(v) => up({ payments: { ...s.payments, wallet: { ...s.payments.wallet, enabled: v } } })} />
              </div>
              {s.payments.wallet.enabled && (
                <Field label="رقم المحفظة">
                  <input className="ai ltr num" value={s.payments.wallet.number} onChange={(e) => up({ payments: { ...s.payments, wallet: { ...s.payments.wallet, number: e.target.value } } })} placeholder="010xxxxxxxx" />
                </Field>
              )}
            </div>
          )}

          {tab === 'builder' && (
            <>
              <div className="a-card a-pad">
                <div className="tgl-row" style={{ paddingTop: 0 }}>
                  <div>
                    <b>قسم «صمّم تورتتك»</b>
                    <small>لو قفلته القسم هيختفي من الموقع</small>
                  </div>
                  <Toggle on={b.enabled} onChange={(v) => upB({ enabled: v })} />
                </div>
                <p className="muted small" style={{ margin: '8px 0 0', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Sparkle size={14} /> السعر = سعر الحجم + (زيادة النكهة × عدد الأدوار) + الديكور
                </p>
              </div>
              <div className="a-card a-pad">
                <b style={{ display: 'block', marginBottom: 12 }}>الأحجام</b>
                <div className="sortable">
                  {b.sizes.map((z, i) => (
                    <div key={z.id} className="sort-row" style={{ flexWrap: 'wrap' }}>
                      <b style={{ width: 70 }}>{z.name.ar}</b>
                      <div style={{ flex: '1 1 200px' }}>
                        <BiInput label="" value={z.serves} onChange={(v) => upB({ sizes: b.sizes.map((x, k) => (k === i ? { ...x, serves: v } : x)) })} max={40} />
                      </div>
                      <div style={{ width: 140 }}>
                        <NumInput value={z.price} onChange={(n) => upB({ sizes: b.sizes.map((x, k) => (k === i ? { ...x, price: n } : x)) })} suffix="ج.م" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="a-card a-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <b>النكهات (الزيادة لكل دور)</b>
                  <button className="ab soft sm" onClick={() => upB({ flavours: [...b.flavours, { id: 'f' + Date.now().toString(36), name: { ar: '', en: '' }, surcharge: 0 }] })}>
                    <Plus size={15} /> نكهة
                  </button>
                </div>
                <div className="sortable">
                  {b.flavours.map((f, i) => (
                    <div key={f.id} className="sort-row" style={{ flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 260px' }}>
                        <BiInput label="" value={f.name} onChange={(v) => upB({ flavours: b.flavours.map((x, k) => (k === i ? { ...x, name: v } : x)) })} max={40} />
                      </div>
                      <div style={{ width: 130 }}>
                        <NumInput value={f.surcharge} onChange={(n) => upB({ flavours: b.flavours.map((x, k) => (k === i ? { ...x, surcharge: n } : x)) })} suffix="+ج.م" />
                      </div>
                      <button className="ab danger sm icon" disabled={b.flavours.length < 2} onClick={() => upB({ flavours: b.flavours.filter((_, k) => k !== i) })} aria-label="حذف">
                        <Trash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="a-card a-pad">
                <b style={{ display: 'block', marginBottom: 12 }}>الديكور</b>
                <div className="sortable">
                  {b.decorations.map((d, i) => (
                    <div key={d.id} className="sort-row" style={{ flexWrap: 'wrap' }}>
                      <b style={{ flex: '1 1 160px' }}>{d.name.ar}</b>
                      <div style={{ width: 140 }}>
                        <NumInput value={d.price} onChange={(n) => upB({ decorations: b.decorations.map((x, k) => (k === i ? { ...x, price: n } : x)) })} suffix="ج.م" />
                      </div>
                      <span className="small muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        لكل دور
                        <Toggle on={d.perTier} onChange={(v) => upB({ decorations: b.decorations.map((x, k) => (k === i ? { ...x, perTier: v } : x)) })} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="a-card a-pad">
                <b style={{ display: 'block', marginBottom: 12 }}>المناسبات والكتابة على التوبر</b>
                <div className="sortable">
                  {b.occasions.map((o, i) => (
                    <div key={o.id} className="sort-row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div style={{ flex: '1 1 240px' }}>
                        <BiInput label="المناسبة" value={o.name} onChange={(v) => upB({ occasions: b.occasions.map((x, k) => (k === i ? { ...x, name: v } : x)) })} max={40} />
                      </div>
                      <div style={{ flex: '1 1 240px' }}>
                        <BiInput label="كلام التوبر" value={o.topper} onChange={(v) => upB({ occasions: b.occasions.map((x, k) => (k === i ? { ...x, topper: v } : x)) })} max={30} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'security' && <Security hasDemo={hasDemo} confirm={confirm.ask} />}
        </div>
      </div>
    </>
  );
}

function Security({ hasDemo, confirm }: { hasDemo: boolean; confirm: (t: string, b: string, ok?: string) => Promise<boolean> }) {
  const { toast } = useAdmin();
  const router = useRouter();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const change = async () => {
    setBusy(true);
    try {
      await api('/api/admin/password', 'POST', { current: cur, next });
      toast('اتغيّرت كلمة السر');
      setCur('');
      setNext('');
    } catch (e) {
      toast((e as { status?: number }).status === 403 ? 'كلمة السر الحالية غلط' : 'كلمة السر الجديدة لازم ٨ حروف على الأقل', true);
    }
    setBusy(false);
  };
  const demo = async (action: 'load' | 'clear') => {
    if (action === 'clear' && !(await confirm('مسح البيانات التجريبية؟', 'الطلبات والزيارات التجريبية بس هي اللي هتتمسح. طلباتك الحقيقية مش هتتأثر.', 'مسح'))) return;
    setBusy(true);
    await api('/api/admin/demo', 'POST', { action });
    toast(action === 'clear' ? 'اتمسحت البيانات التجريبية' : 'اتضافت بيانات تجريبية');
    router.refresh();
    setBusy(false);
  };
  return (
    <>
      <div className="a-card a-pad a-grid">
        <b>تغيير كلمة السر</b>
        <div className="ai-row">
          <Field label="كلمة السر الحالية">
            <input className="ai" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
          </Field>
          <Field label="كلمة السر الجديدة" hint="٨ حروف على الأقل">
            <input className="ai" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
        <button className="ab primary" style={{ justifySelf: 'start' }} disabled={busy || !cur || next.length < 8} onClick={change}>
          <Lock size={16} /> غيّر كلمة السر
        </button>
      </div>
      <div className="a-card a-pad a-grid">
        <b>نسخة احتياطية</b>
        <p className="muted small" style={{ margin: 0 }}>نزّل كل بيانات الموقع (المنتجات، الطلبات، الإعدادات) في ملف واحد. يُفضّل تعملها كل أسبوع.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="ab ghost" href="/api/admin/export">
            <DownloadSimple size={17} /> نزّل نسخة احتياطية
          </a>
          <a className="ab ghost" href="/api/admin/orders/export">
            <DownloadSimple size={17} /> الطلبات (Excel)
          </a>
        </div>
      </div>
      <div className="a-card a-pad a-grid">
        <b>بيانات تجريبية</b>
        <p className="muted small" style={{ margin: 0 }}>طلبات وزيارات وهمية عشان تجرّب لوحة التحكم. بتتعلّم «تجريبي» وتتمسح بضغطة من غير ما تلمس طلباتك الحقيقية.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {hasDemo ? (
            <button className="ab danger" onClick={() => demo('clear')} disabled={busy}>
              <Trash size={16} /> امسح البيانات التجريبية
            </button>
          ) : (
            <button className="ab soft" onClick={() => demo('load')} disabled={busy}>
              <Sparkle size={16} /> ضيف بيانات تجريبية
            </button>
          )}
        </div>
      </div>
    </>
  );
}
