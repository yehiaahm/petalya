'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRight, Cake, FloppyDisk, Images, Plus, Trash } from '@phosphor-icons/react';
import type { Category, Product } from '@/lib/types';
import { api, BiInput, Field, ImageManager, NumInput, Toggle, useAdmin, useConfirm } from './ui';

const blank = (cat: string): Product => ({ id: '', categoryId: cat, name: { ar: '', en: '' }, desc: { ar: '', en: '' }, price: 0, compareAt: null, images: [], active: true, featured: false, soldOut: false, leadDays: null, sort: 999, createdAt: '', updatedAt: '' });

export function ProductEditor({ product, categories }: { product: Product | null; categories: Category[] }) {
  const router = useRouter();
  const { toast } = useAdmin();
  const confirm = useConfirm();
  const isNew = !product;
  const [p, setP] = useState<Product>(product ?? blank(categories[0]?.id ?? ''));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [err, setErr] = useState('');

  const set = <K extends keyof Product>(k: K, v: Product[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', h);
    return () => removeEventListener('beforeunload', h);
  }, [dirty]);

  const save = async () => {
    setErr('');
    if (!p.name.ar.trim() && !p.name.en.trim()) return setErr('اكتب اسم المنتج');
    if (!p.price || p.price <= 0) return setErr('اكتب سعر المنتج');
    setBusy(true);
    try {
      const saved = isNew ? await api<Product>('/api/admin/products', 'POST', p) : await api<Product>(`/api/admin/products/${p.id}`, 'PATCH', p);
      setDirty(false);
      toast(isNew ? 'المنتج اتضاف للمنيو 🎉' : 'اتحفظت التعديلات');
      if (isNew) router.replace(`/admin/products/${saved.id}`);
      else setP(saved);
      router.refresh();
    } catch {
      toast('مقدرناش نحفظ', true);
    }
    setBusy(false);
  };
  const del = async () => {
    if (!(await confirm.ask(`حذف «${p.name.ar}»؟`, 'المنتج هيختفي من المنيو نهائيًا.'))) return;
    await api(`/api/admin/products/${p.id}`, 'DELETE');
    toast('اتحذف المنتج');
    router.push('/admin/products');
    router.refresh();
  };

  const name = p.name[lang] || p.name.ar || p.name.en || (lang === 'ar' ? 'اسم المنتج' : 'Product name');
  const desc = p.desc[lang] || p.desc.ar || p.desc.en || (lang === 'ar' ? 'وصف قصير للمنتج' : 'A short description');
  const fmt = (n: number) => (lang === 'ar' ? `${n.toLocaleString('en-US')} ج.م` : `EGP ${n.toLocaleString('en-US')}`);

  return (
    <>
      {confirm.node}
      <div className="a-ph">
        <div>
          <Link href="/admin/products" className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ArrowRight size={14} /> كل المنتجات
          </Link>
          <h1 style={{ marginTop: 4 }}>{isNew ? 'منتج جديد' : p.name.ar || 'تعديل منتج'}</h1>
          {!isNew && <p>آخر تعديل {new Date(p.updatedAt).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        </div>
        <div className="acts">
          {!isNew && (
            <button className="ab danger" onClick={del}>
              <Trash size={17} /> حذف
            </button>
          )}
          <button className="ab primary" onClick={save} disabled={busy} style={{ minWidth: 140 }}>
            {isNew ? <Plus size={18} weight="bold" /> : <FloppyDisk size={18} />}
            {busy ? 'بنحفظ…' : isNew ? 'أضف للمنيو' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
      {err && (
        <div className="a-card a-pad" style={{ marginBottom: 14, background: 'var(--bad-bg)', color: 'var(--bad)', borderColor: 'transparent' }}>
          {err}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <div className="a-grid" style={{ flex: '2 1 480px', minWidth: 0 }}>
          <div className="a-card a-pad a-grid">
            <BiInput label="اسم المنتج" value={p.name} onChange={(v) => set('name', v)} max={120} />
            <BiInput label="الوصف (بيظهر تحت الاسم في المنيو)" value={p.desc} onChange={(v) => set('desc', v)} multiline max={600} />
          </div>

          <div className="a-card a-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <b style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Images size={20} color="#B97E5E" /> الصور
              </b>
              <span className="faint small">أول صورة هي اللي بتظهر في المنيو · العميل يقدر يقلّب في الباقي</span>
            </div>
            <ImageManager images={p.images} onChange={(v) => set('images', v)} />
          </div>

          <div className="a-card a-pad a-grid">
            <div className="ai-row">
              <Field label="السعر">
                <NumInput value={p.price} onChange={(n) => set('price', n)} suffix="ج.م" />
              </Field>
              <Field label="السعر قبل الخصم (اختياري)" hint="لو كتبته هيظهر مشطوب جنب السعر">
                <NumInput value={p.compareAt ?? 0} onChange={(n) => set('compareAt', n || null)} suffix="ج.م" />
              </Field>
            </div>
            <div className="ai-row">
              <Field label="القسم">
                <select className="ai" value={p.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name.ar}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="أيام التحضير (اختياري)" hint="أقل عدد أيام قبل التسليم. سيبه فاضي للعادي.">
                <NumInput value={p.leadDays ?? 0} onChange={(n) => set('leadDays', n || null)} suffix="يوم" />
              </Field>
            </div>
          </div>
        </div>

        <div className="a-grid" style={{ flex: '1 1 320px', minWidth: 0, position: 'sticky', top: 88 }}>
          <div className="a-card a-pad">
            <div className="tgl-row">
              <div>
                <b>ظاهر في الموقع</b>
                <small>لو قفلته المنتج يختفي من المنيو بس مش بيتحذف</small>
              </div>
              <Toggle on={p.active} onChange={(v) => set('active', v)} />
            </div>
            <div className="tgl-row">
              <div>
                <b>متاح للطلب</b>
                <small>اقفله لو المنتج خلص النهارده</small>
              </div>
              <Toggle on={!p.soldOut} onChange={(v) => set('soldOut', !v)} />
            </div>
            <div className="tgl-row">
              <div>
                <b>منتج مميز</b>
                <small>بيتعلّم كمميز في لوحة التحكم</small>
              </div>
              <Toggle on={!!p.featured} onChange={(v) => set('featured', v)} />
            </div>
          </div>

          <div className="a-card a-pad" style={{ background: 'var(--blush-section)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <b>معاينة في المنيو</b>
              <div className="a-tabs">
                <button className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>
                  ع
                </button>
                <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>
                  EN
                </button>
              </div>
            </div>
            <div dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
              <div className="menu-card" style={{ opacity: p.active ? 1 : 0.55 }}>
                <span className="thumb" style={{ cursor: 'default' }}>
                  {p.images[0] ? <img className="cover" src={p.images[0]} alt="" /> : <Cake size={34} weight="light" />}
                </span>
                <div className="body">
                  <span className="name" style={lang === 'en' ? { font: "600 23px/1.1 var(--f-cormorant), serif" } : undefined}>
                    {name}
                  </span>
                  <span className="desc">{desc}</span>
                  <div className="foot">
                    <span className="price">
                      {fmt(p.price || 0)}
                      {p.compareAt && p.compareAt > p.price ? <s>{fmt(p.compareAt)}</s> : null}
                    </span>
                    {p.soldOut ? (
                      <span className="soldout">{lang === 'ar' ? 'خلصت النهارده' : 'Sold out'}</span>
                    ) : (
                      <span className="add-btn">
                        <Plus size={16} weight="bold" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
