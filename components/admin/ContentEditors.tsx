'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChatCircleText, Check, Copy, EyeSlash, Images, Key, PencilSimple, Plus, Star, Ticket, Trash, UserCircle } from '@phosphor-icons/react';
import type { Coupon, GalleryItem, Review } from '@/lib/types';
import { api, BiInput, egp, Empty, Field, ImageManager, Modal, NumInput, PageHeader, Toggle, useAdmin, useConfirm } from './ui';

function useListSave<T>(url: string, initial: T[]) {
  const router = useRouter();
  const { toast } = useAdmin();
  const [list, setList] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async (next: T[], msg = 'اتحفظ') => {
    const prev = list;
    setList(next);
    setBusy(true);
    try {
      setList(await api<T[]>(url, 'PUT', next));
      toast(msg);
      router.refresh();
    } catch {
      setList(prev);
      toast('مقدرناش نحفظ', true);
    }
    setBusy(false);
  };
  return { list, save, busy };
}

const move = <T,>(a: T[], i: number, d: number) => {
  const b = [...a], j = i + d;
  if (j < 0 || j >= b.length) return a;
  [b[i], b[j]] = [b[j], b[i]];
  return b;
};

/* ======================= Gallery ======================= */
export type ProductOption = { id: string; name: string };

export function GalleryEditor({ items, products }: { items: GalleryItem[]; products: ProductOption[] }) {
  const { list, save, busy } = useListSave('/api/admin/gallery', items);
  const confirm = useConfirm();
  const [edit, setEdit] = useState<GalleryItem | null>(null);
  const blank: GalleryItem = { id: '', image: '', tilt: 0, title: { ar: '', en: '' }, occasion: { ar: '', en: '' }, note: { ar: '', en: '' }, active: true, sort: 0 };

  const commit = (g: GalleryItem) => {
    const exists = list.some((x) => x.id === g.id && g.id);
    save(exists ? list.map((x) => (x.id === g.id ? g : x)) : [...list, { ...g, id: 'g-' + Date.now().toString(36), tilt: g.tilt || [-2.5, 2, -1.5, 3, -2][list.length % 5] }], exists ? 'اتحفظت الصورة' : 'اتضافت للمعرض');
    setEdit(null);
  };

  return (
    <>
      {confirm.node}
      <PageHeader title="معرض الشغل" sub="الصور المتعلّقة على الحبل في قسم «من مطبخنا». العميل بيقلب الصورة يشوف الحكاية ويطلب زيها.">
        <button className="ab primary" onClick={() => setEdit(blank)}>
          <Plus size={18} weight="bold" /> صورة جديدة
        </button>
      </PageHeader>
      {list.length ? (
        <div className="p-grid">
          {list.map((g, i) => (
            <div key={g.id} className={'a-card p-card' + (!g.active ? ' off' : '')}>
              <div className="img" style={{ aspectRatio: '1/1.08', padding: 10, background: 'var(--paper)' }}>
                <div style={{ width: '100%', height: '100%', background: '#F3E4DA', overflow: 'hidden', transform: `rotate(${g.tilt}deg)`, boxShadow: '0 16px 26px -18px rgba(74,44,34,.6)' }}>
                  {g.image && <img src={g.image} alt="" />}
                </div>
                {!g.active && (
                  <span className="flags">
                    <span className="pill plain st-cancelled">مخفية</span>
                  </span>
                )}
              </div>
              <div className="bd">
                <span className="faint small">{g.occasion.ar}</span>
                <h3>{g.title.ar}</h3>
                <p className="muted small" style={{ margin: 0 }}>{g.note.ar}</p>
                <div className="ft">
                  <button className="ab soft sm" style={{ flex: 1 }} onClick={() => setEdit(g)}>
                    <PencilSimple size={15} /> تعديل
                  </button>
                  <Toggle on={g.active} onChange={(v) => save(list.map((x) => (x.id === g.id ? { ...x, active: v } : x)), v ? 'الصورة ظاهرة' : 'الصورة اتخفت')} label="ظاهرة" />
                  <button className="ab ghost sm icon" disabled={i === 0 || busy} onClick={() => save(move(list, i, -1), 'اتغيّر الترتيب')} aria-label="قدّم">
                    <ArrowUp size={14} style={{ transform: 'rotate(90deg)' }} />
                  </button>
                  <button className="ab ghost sm icon" disabled={i === list.length - 1 || busy} onClick={() => save(move(list, i, 1), 'اتغيّر الترتيب')} aria-label="أخّر">
                    <ArrowDown size={14} style={{ transform: 'rotate(90deg)' }} />
                  </button>
                  <button
                    className="ab danger sm icon"
                    aria-label="حذف"
                    onClick={async () => (await confirm.ask('حذف الصورة؟', `«${g.title.ar}» هتختفي من المعرض.`)) && save(list.filter((x) => x.id !== g.id), 'اتحذفت')}
                  >
                    <Trash size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="a-card">
          <Empty icon={<Images size={30} />} title="المعرض فاضي" />
        </div>
      )}
      {edit && <GalleryModal item={edit} products={products} onClose={() => setEdit(null)} onSave={commit} />}
    </>
  );
}

function GalleryModal({ item, products, onClose, onSave }: { item: GalleryItem; products: ProductOption[]; onClose: () => void; onSave: (g: GalleryItem) => void }) {
  const [g, setG] = useState(item);
  const ok = g.image && g.title.ar.trim();
  return (
    <Modal
      open
      onClose={onClose}
      title={item.id ? 'تعديل صورة' : 'صورة جديدة للمعرض'}
      width={640}
      footer={
        <>
          <button className="ab ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="ab primary" disabled={!ok} onClick={() => onSave(g)}>
            <Check size={16} /> حفظ
          </button>
        </>
      }
    >
      <ImageManager single images={g.image ? [g.image] : []} onChange={(v) => setG({ ...g, image: v[0] || '' })} />
      <BiInput label="العنوان (على الصورة)" value={g.title} onChange={(v) => setG({ ...g, title: v })} max={80} />
      <BiInput label="المناسبة" value={g.occasion} onChange={(v) => setG({ ...g, occasion: v })} max={60} />
      <BiInput label="الحكاية (ضهر الصورة)" value={g.note} onChange={(v) => setG({ ...g, note: v })} multiline max={300} />
      <Field label="المنتج اللي زرار «اطلب زيها» يضيفه للطلب" hint="لو سيبته فاضي الزرار هيودّي العميل لتصميم التورتة.">
        <select className="ai" value={g.productId || ''} onChange={(e) => setG({ ...g, productId: e.target.value || undefined })}>
          <option value="">— تصميم التورتة (من غير ربط) —</option>
          {products.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`ميلان الصورة على الحبل: ${g.tilt}°`}>
        <input type="range" min={-5} max={5} step={0.5} value={g.tilt} onChange={(e) => setG({ ...g, tilt: Number(e.target.value) })} />
      </Field>
    </Modal>
  );
}

/* ======================= Review screenshots ======================= */
export function ReviewShotsEditor({ shots }: { shots: string[] }) {
  const router = useRouter();
  const { toast } = useAdmin();
  const [saved, setSaved] = useState(shots);
  const [list, setList] = useState(shots);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(list) !== JSON.stringify(saved);
  const save = async () => {
    setBusy(true);
    try {
      const next = await api<string[]>('/api/admin/review-shots', 'PUT', list);
      setSaved(next);
      setList(next);
      toast('اتحفظت سكرينات الآراء');
      router.refresh();
    } catch {
      toast('مقدرناش نحفظ', true);
    }
    setBusy(false);
  };
  return (
    <div className="a-card a-pad" style={{ marginBottom: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <b style={{ fontWeight: 700, fontSize: 17 }}>سكرينات آراء العملاء</b>
          <p className="muted small" style={{ margin: '4px 0 0' }}>
            صور محادثات العملاء اللي بتتحرك في قسم «حلاوة بتتحكي» والعميل بيضغط عليها يشوفها كبيرة. الترتيب هنا هو ترتيبها في الموقع.
          </p>
        </div>
        <button className="ab primary" disabled={!dirty || busy} onClick={save}>
          <Check size={16} /> حفظ
        </button>
      </div>
      <ImageManager images={list} onChange={setList} max={40} />
    </div>
  );
}

/* ======================= Reviews ======================= */
export function ReviewsEditor({ reviews }: { reviews: Review[] }) {
  const { list, save } = useListSave('/api/admin/reviews', reviews);
  const confirm = useConfirm();
  const [tab, setTab] = useState<'all' | Review['status']>(reviews.some((r) => r.status === 'pending') ? 'pending' : 'all');
  const [edit, setEdit] = useState<Review | null>(null);
  const shown = list.filter((r) => tab === 'all' || r.status === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const setStatus = (r: Review, status: Review['status']) => save(list.map((x) => (x.id === r.id ? { ...x, status } : x)), status === 'approved' ? 'الرأي ظاهر في الموقع' : 'الرأي اتخفى');
  const blank: Review = { id: '', name: { ar: '', en: '' }, occasion: { ar: '', en: '' }, quote: { ar: '', en: '' }, rating: 5, status: 'approved', createdAt: '' };

  return (
    <>
      {confirm.node}
      <PageHeader title="آراء العملاء" sub="الآراء الموافق عليها بس هي اللي بتظهر في الكروت على الموقع. العملاء يقدروا يكتبوا رأيهم بعد ما الطلب يتسلّم.">
        <button className="ab primary" onClick={() => setEdit(blank)}>
          <Plus size={18} weight="bold" /> أضف رأي
        </button>
      </PageHeader>
      <div className="a-tabs" style={{ marginBottom: 14 }}>
        {(
          [
            ['pending', 'مستني موافقة'],
            ['approved', 'ظاهر'],
            ['hidden', 'مخفي'],
            ['all', 'الكل'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l} <span className="c num">{k === 'all' ? list.length : list.filter((r) => r.status === k).length}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="a-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {shown.map((r) => (
            <div key={r.id} className="a-card a-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', gap: 2, color: '#C08A5E' }}>
                  {Array.from({ length: 5 }, (_, k) => (
                    <Star key={k} size={16} weight={k < r.rating ? 'fill' : 'regular'} />
                  ))}
                </span>
                <span className={'pill ' + (r.status === 'approved' ? 'st-delivered' : r.status === 'pending' ? 'st-new' : 'st-cancelled')}>{r.status === 'approved' ? 'ظاهر' : r.status === 'pending' ? 'جديد' : 'مخفي'}</span>
              </div>
              <p style={{ margin: 0, font: '500 16px/1.8 var(--f-messiri), serif' }}>{r.quote.ar}</p>
              {r.quote.en && r.quote.en !== r.quote.ar && <p className="muted small ltr" style={{ margin: 0, fontStyle: 'italic' }}>{r.quote.en}</p>}
              <div className="who" style={{ marginTop: 'auto' }}>
                <span className="av">{r.name.ar.charAt(0)}</span>
                <div>
                  <b style={{ fontWeight: 600 }}>{r.name.ar}</b>
                  <div className="faint small">
                    {r.occasion.ar}
                    {r.orderCode && <span className="ltr"> · {r.orderCode}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {r.status !== 'approved' && (
                  <button className="ab primary sm" onClick={() => setStatus(r, 'approved')}>
                    <Check size={15} /> اعرضه
                  </button>
                )}
                {r.status !== 'hidden' && (
                  <button className="ab ghost sm" onClick={() => setStatus(r, 'hidden')}>
                    <EyeSlash size={15} /> اخفيه
                  </button>
                )}
                <button className="ab soft sm" onClick={() => setEdit(r)}>
                  <PencilSimple size={15} /> تعديل
                </button>
                <button className="ab danger sm icon" aria-label="حذف" onClick={async () => (await confirm.ask('حذف الرأي؟', 'مش هتقدر ترجّعه.')) && save(list.filter((x) => x.id !== r.id), 'اتحذف')}>
                  <Trash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="a-card">
          <Empty icon={<ChatCircleText size={30} />} title="مفيش آراء هنا" />
        </div>
      )}
      {edit && (
        <ReviewModal
          review={edit}
          onClose={() => setEdit(null)}
          onSave={(r) => {
            save(r.id ? list.map((x) => (x.id === r.id ? r : x)) : [...list, { ...r, id: 'r-' + Date.now().toString(36), createdAt: new Date().toISOString() }], 'اتحفظ الرأي');
            setEdit(null);
          }}
        />
      )}
    </>
  );
}

function ReviewModal({ review, onClose, onSave }: { review: Review; onClose: () => void; onSave: (r: Review) => void }) {
  const [r, setR] = useState(review);
  return (
    <Modal
      open
      onClose={onClose}
      title={review.id ? 'تعديل الرأي' : 'رأي جديد'}
      width={620}
      footer={
        <>
          <button className="ab ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="ab primary" disabled={!r.quote.ar.trim() || !r.name.ar.trim()} onClick={() => onSave(r)}>
            حفظ
          </button>
        </>
      }
    >
      <BiInput label="الرأي" value={r.quote} onChange={(v) => setR({ ...r, quote: v })} multiline max={500} />
      <BiInput label="اسم العميل" value={r.name} onChange={(v) => setR({ ...r, name: v })} max={60} />
      <BiInput label="المناسبة" value={r.occasion} onChange={(v) => setR({ ...r, occasion: v })} max={60} />
      <Field label="التقييم">
        <span style={{ display: 'flex', gap: 4, color: '#C08A5E' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setR({ ...r, rating: n })} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', padding: 2 }} aria-label={`${n}`}>
              <Star size={26} weight={n <= r.rating ? 'fill' : 'regular'} />
            </button>
          ))}
        </span>
      </Field>
    </Modal>
  );
}

/* ======================= Coupons ======================= */
export function CouponsEditor({ coupons }: { coupons: Coupon[] }) {
  const { list, save } = useListSave('/api/admin/coupons', coupons);
  const confirm = useConfirm();
  const [edit, setEdit] = useState<Coupon | null>(null);
  const blank: Coupon = { id: '', code: '', type: 'percent', value: 10, minSubtotal: 0, active: true, uses: 0, maxUses: null, expiresAt: null, createdAt: '' };
  return (
    <>
      {confirm.node}
      <PageHeader title="أكواد الخصم" sub="اعمل كود لحملة على إنستجرام أو لعميلة مميزة — العميل بيكتبه في صفحة الطلب.">
        <button className="ab primary" onClick={() => setEdit(blank)}>
          <Plus size={18} weight="bold" /> كود جديد
        </button>
      </PageHeader>
      <div className="a-card tbl-wrap">
        {list.length ? (
          <table className="tbl fit-sm">
            <thead>
              <tr>
                <th>الكود</th>
                <th>الخصم</th>
                <th className="hide-sm">أقل طلب</th>
                <th className="hide-sm">الاستخدام</th>
                <th className="hide-sm">ينتهي</th>
                <th>شغال</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const expired = c.expiresAt && c.expiresAt < new Date().toISOString().slice(0, 10);
                return (
                  <tr key={c.id}>
                    <td>
                      <b className="ltr" style={{ fontWeight: 700, letterSpacing: '.06em', padding: '4px 10px', borderRadius: 8, border: '1.5px dashed var(--copper-line)', background: '#FDF6F0' }}>
                        {c.code}
                      </b>
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>{c.type === 'percent' ? `${c.value}%` : egp(c.value)}</td>
                    <td className="num hide-sm">{c.minSubtotal ? egp(c.minSubtotal) : '—'}</td>
                    <td className="num hide-sm">
                      {c.uses}
                      {c.maxUses ? ` / ${c.maxUses}` : ''}
                    </td>
                    <td className="hide-sm">{c.expiresAt ? <span style={{ color: expired ? 'var(--bad)' : undefined }}>{new Date(c.expiresAt + 'T12:00').toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}</span> : 'مفتوح'}</td>
                    <td>
                      <Toggle on={c.active} onChange={(v) => save(list.map((x) => (x.id === c.id ? { ...x, active: v } : x)), v ? 'الكود شغال' : 'الكود اتقفل')} label="شغال" />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="ab soft sm icon" onClick={() => setEdit(c)} aria-label="تعديل">
                        <PencilSimple size={15} />
                      </button>{' '}
                      <button className="ab danger sm icon" aria-label="حذف" onClick={async () => (await confirm.ask(`حذف ${c.code}؟`, 'الكود هيبطل يشتغل فورًا.')) && save(list.filter((x) => x.id !== c.id), 'اتحذف الكود')}>
                        <Trash size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <Empty icon={<Ticket size={30} />} title="مفيش أكواد لسه" />
        )}
      </div>
      {edit && (
        <CouponModal
          coupon={edit}
          taken={list.filter((x) => x.id !== edit.id).map((x) => x.code)}
          onClose={() => setEdit(null)}
          onSave={(c) => {
            save(c.id ? list.map((x) => (x.id === c.id ? c : x)) : [...list, { ...c, id: 'cp-' + Date.now().toString(36), createdAt: new Date().toISOString() }], 'اتحفظ الكود');
            setEdit(null);
          }}
        />
      )}
    </>
  );
}

function CouponModal({ coupon, taken, onClose, onSave }: { coupon: Coupon; taken: string[]; onClose: () => void; onSave: (c: Coupon) => void }) {
  const [c, setC] = useState(coupon);
  const code = c.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const dup = taken.includes(code);
  return (
    <Modal
      open
      onClose={onClose}
      title={coupon.id ? 'تعديل كود' : 'كود خصم جديد'}
      footer={
        <>
          <button className="ab ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="ab primary" disabled={!code || dup || !c.value} onClick={() => onSave({ ...c, code })}>
            حفظ
          </button>
        </>
      }
    >
      <Field label="الكود" hint={dup ? <span style={{ color: 'var(--bad)' }}>الكود ده موجود</span> : 'حروف إنجليزي وأرقام بس'}>
        <input className="ai ltr" style={{ textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }} value={c.code} onChange={(e) => setC({ ...c, code: e.target.value })} placeholder="EID20" />
      </Field>
      <div className="ai-row">
        <Field label="نوع الخصم">
          <select className="ai" value={c.type} onChange={(e) => setC({ ...c, type: e.target.value as Coupon['type'] })}>
            <option value="percent">نسبة %</option>
            <option value="fixed">مبلغ ثابت</option>
          </select>
        </Field>
        <Field label="القيمة">
          <NumInput value={c.value} onChange={(n) => setC({ ...c, value: n })} suffix={c.type === 'percent' ? '%' : 'ج.م'} />
        </Field>
      </div>
      <div className="ai-row">
        <Field label="أقل قيمة للطلب">
          <NumInput value={c.minSubtotal} onChange={(n) => setC({ ...c, minSubtotal: n })} suffix="ج.م" />
        </Field>
        <Field label="أقصى عدد مرات (اختياري)">
          <NumInput value={c.maxUses ?? 0} onChange={(n) => setC({ ...c, maxUses: n || null })} />
        </Field>
      </div>
      <Field label="ينتهي يوم (اختياري)">
        <input type="date" className="ai" value={c.expiresAt ?? ''} onChange={(e) => setC({ ...c, expiresAt: e.target.value || null })} />
      </Field>
    </Modal>
  );
}

/* ======================= Customers ======================= */
export type CustomerRow = {
  key: string;
  phone: string;
  name: string;
  orders: number;
  spent: number;
  last: string;
  first: string;
  zone?: string;
  account?: { id: string; email: string; google: boolean; hasPassword: boolean; avatar?: string; createdAt: string; lastLoginAt: string };
};

export function Customers({ rows: initial }: { rows: CustomerRow[] }) {
  const router = useRouter();
  const { toast } = useAdmin();
  const confirm = useConfirm();
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'accounts' | 'guests'>('all');
  const [sort, setSort] = useState<'spent' | 'orders' | 'last'>('last');
  const [temp, setTemp] = useState<{ name: string; phone: string; email: string; password: string } | null>(null);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows
      .filter((r) => tab === 'all' || (tab === 'accounts' ? !!r.account : !r.account))
      .filter((r) => !n || r.name.toLowerCase().includes(n) || r.phone.includes(n) || !!r.account?.email.includes(n))
      .sort((a, b) => (sort === 'last' ? b.last.localeCompare(a.last) : b[sort] - a[sort]));
  }, [rows, q, sort, tab]);
  const repeat = rows.filter((r) => r.orders > 1).length;
  const accounts = rows.filter((r) => r.account).length;

  const reset = async (r: CustomerRow) => {
    if (!r.account || !(await confirm.ask('كلمة سر مؤقتة؟', `هنعمل كلمة سر جديدة لـ ${r.name} والقديمة هتبطل. ابعتها للعميل وخليه يغيّرها من حسابه.`, 'اعمل كلمة سر'))) return;
    const j = await api<{ password: string }>(`/api/admin/users/${r.account.id}`, 'PATCH');
    setTemp({ name: r.name, phone: r.phone, email: r.account.email, password: j.password });
  };
  const remove = async (r: CustomerRow) => {
    if (!r.account || !(await confirm.ask('حذف الحساب؟', `حساب ${r.account.email} هيتحذف. طلباته هتفضل محفوظة عندك.`))) return;
    await api(`/api/admin/users/${r.account.id}`, 'DELETE');
    setRows((l) => l.flatMap((x) => (x.key !== r.key ? [x] : x.orders ? [{ ...x, account: undefined }] : [])));
    toast('اتحذف الحساب');
    router.refresh();
  };

  const tabs: [typeof tab, string, number][] = [
    ['all', 'الكل', rows.length],
    ['accounts', 'عندهم حساب', accounts],
    ['guests', 'طلبوا من غير حساب', rows.length - accounts],
  ];

  return (
    <>
      {confirm.node}
      <PageHeader title="العملاء" sub={`${rows.length} عميل · ${accounts} عاملين حساب · ${repeat} رجعوا يطلبوا تاني (${rows.length ? Math.round((repeat / rows.length) * 100) : 0}%)`} />
      <div className="a-tabs" style={{ marginBottom: 14 }}>
        {tabs.map(([k, l, c]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l} <span className="c num">{c}</span>
          </button>
        ))}
      </div>
      <div className="a-card">
        <div style={{ display: 'flex', gap: 10, padding: 14, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <input className="ai" style={{ flex: '1 1 220px', height: 40 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الموبايل أو الإيميل" />
          <select className="ai" style={{ width: 180, height: 40 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="last">آخر نشاط</option>
            <option value="spent">الأكثر إنفاقًا</option>
            <option value="orders">الأكثر طلبات</option>
          </select>
        </div>
        <div className="tbl-wrap">
          {list.length ? (
            <table className="tbl fit-sm">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th className="hide-sm">الحساب</th>
                  <th className="hide-sm">الطلبات</th>
                  <th>إجمالي الإنفاق</th>
                  <th className="hide-sm">آخر نشاط</th>
                  <th className="hide-sm">المنطقة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.key} className={r.phone ? 'click' : ''} onClick={() => r.phone && router.push(`/admin/orders?phone=${r.phone}`)}>
                    <td>
                      <div className="who">
                        <span className="av" style={{ overflow: 'hidden' }}>
                          {r.account?.avatar ? <img src={r.account.avatar} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : r.name.charAt(0)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <b style={{ fontWeight: 600 }}>{r.name}</b>
                          {r.orders > 2 && (
                            <span className="pill plain st-preparing" style={{ marginInlineStart: 8, height: 20 }}>
                              عميل دايم
                            </span>
                          )}
                          <div className="faint small ltr num" style={{ textAlign: 'right' }}>
                            {r.phone || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hide-sm">
                      {r.account ? (
                        <div>
                          <span className="pill plain" style={{ background: r.account.google ? '#EEF3FD' : 'var(--blush-tile)', color: r.account.google ? '#3F5F86' : 'var(--copper-text)' }}>
                            <UserCircle size={14} /> {r.account.google ? 'Google' : 'إيميل'}
                          </span>
                          <div className="faint small ltr" style={{ textAlign: 'right', marginTop: 2 }}>
                            {r.account.email}
                          </div>
                        </div>
                      ) : (
                        <span className="faint small">زائر</span>
                      )}
                    </td>
                    <td className="num hide-sm">{r.orders}</td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {egp(r.spent)}
                    </td>
                    <td className="hide-sm">{new Date(r.account && r.account.lastLoginAt > r.last ? r.account.lastLoginAt : r.last).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="muted hide-sm">{r.zone || (r.orders ? 'استلام' : '—')}</td>
                    <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      {r.account && (
                        <>
                          <button className="ab soft sm icon" title="كلمة سر مؤقتة (لو العميل نسي كلمة السر)" aria-label="كلمة سر مؤقتة" onClick={() => reset(r)}>
                            <Key size={15} />
                          </button>{' '}
                          <button className="ab danger sm icon" title="حذف الحساب" aria-label="حذف الحساب" onClick={() => remove(r)}>
                            <Trash size={15} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty icon={<UserCircle size={30} />} title="مفيش عملاء هنا" />
          )}
        </div>
      </div>
      {temp && (
        <Modal
          open
          title="كلمة السر المؤقتة"
          onClose={() => setTemp(null)}
          footer={
            <button className="ab primary" onClick={() => setTemp(null)}>
              تمام
            </button>
          }
        >
          <p className="muted" style={{ margin: 0 }}>
            ابعتها لـ {temp.name}. هيدخل بيها بالإيميل <b className="ltr">{temp.email}</b> ويغيّرها من «بياناتي».
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 14, background: 'var(--blush-panel)' }}>
            <b className="ltr num" style={{ fontSize: 20, letterSpacing: '.08em', flex: 1 }}>
              {temp.password}
            </b>
            <button className="ab ghost sm" onClick={() => navigator.clipboard.writeText(temp.password).then(() => toast('اتنسخت'))}>
              <Copy size={15} /> نسخ
            </button>
          </div>
          {temp.phone && (
            <a
              className="ab wa"
              target="_blank"
              rel="noopener"
              href={`https://wa.me/${temp.phone.replace(/^0/, '20')}?text=${encodeURIComponent(`أهلاً ${temp.name.split(' ')[0]}! دي كلمة سر مؤقتة لحسابك على موقع Petalya: ${temp.password}\nادخل بيها وغيّرها من صفحة «بياناتي».`)}`}
            >
              ابعتها على واتساب
            </a>
          )}
        </Modal>
      )}
    </>
  );
}
