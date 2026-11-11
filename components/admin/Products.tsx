'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Cake, DotsSixVertical, Eye, EyeSlash, Images, PencilSimple, Plus, Star, Tag, Trash } from '@phosphor-icons/react';
import type { Category, Product } from '@/lib/types';
import { arCount } from '@/lib/ar';
import { api, BiInput, egp, Empty, Modal, PageHeader, Toggle, useAdmin, useConfirm } from './ui';

export function Products({ products: initial, categories: initialCats, sales }: { products: Product[]; categories: Category[]; sales: Record<string, number> }) {
  const router = useRouter();
  const { toast } = useAdmin();
  const confirm = useConfirm();
  const [products, setProducts] = useState(initial);
  const [cats, setCats] = useState(initialCats);
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [catsOpen, setCatsOpen] = useState(false);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return products
      .filter((p) => cat === 'all' || p.categoryId === cat)
      .filter((p) => !n || p.name.ar.toLowerCase().includes(n) || p.name.en.toLowerCase().includes(n))
      .sort((a, b) => (cat === 'all' ? cats.findIndex((c) => c.id === a.categoryId) - cats.findIndex((c) => c.id === b.categoryId) : 0) || a.sort - b.sort);
  }, [products, cat, q, cats]);

  const patch = async (p: Product, body: Partial<Product>, msg: string) => {
    setProducts((l) => l.map((x) => (x.id === p.id ? { ...x, ...body } : x)));
    try {
      await api(`/api/admin/products/${p.id}`, 'PATCH', body);
      toast(msg);
      router.refresh();
    } catch {
      setProducts((l) => l.map((x) => (x.id === p.id ? p : x)));
      toast('تعذّر الحفظ، حاول مرة أخرى', true);
    }
  };
  const del = async (p: Product) => {
    if (!(await confirm.ask(`حذف «${p.name.ar}»؟`, 'سيُحذف المنتج من المنيو، وستبقى الطلبات السابقة التي تحتويه كما هي.'))) return;
    setProducts((l) => l.filter((x) => x.id !== p.id));
    await api(`/api/admin/products/${p.id}`, 'DELETE');
    toast('تم حذف المنتج');
    router.refresh();
  };
  const move = async (p: Product, d: number) => {
    const same = products.filter((x) => x.categoryId === p.categoryId).sort((a, b) => a.sort - b.sort);
    const i = same.findIndex((x) => x.id === p.id), j = i + d;
    if (j < 0 || j >= same.length) return;
    [same[i], same[j]] = [same[j], same[i]];
    const ids = same.map((x) => x.id);
    setProducts((l) => l.map((x) => (ids.includes(x.id) ? { ...x, sort: ids.indexOf(x.id) } : x)));
    await api('/api/admin/products', 'PUT', { ids });
    router.refresh();
  };

  const catName = (id: string) => cats.find((c) => c.id === id)?.name.ar ?? '—';

  return (
    <>
      {confirm.node}
      <PageHeader title="المنتجات والمنيو" sub={`${arCount(products.length, 'product')} · الظاهر منها في الموقع: ${products.filter((p) => p.active).length}`}>
        <button className="ab ghost" onClick={() => setCatsOpen(true)}>
          <Tag size={18} />
          الأقسام
        </button>
        <Link href="/admin/products/new" className="ab primary">
          <Plus size={18} weight="bold" />
          منتج جديد
        </Link>
      </PageHeader>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div className="a-tabs">
          <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>
            الكل <span className="c num">{products.length}</span>
          </button>
          {cats.map((c) => (
            <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
              {c.name.ar} <span className="c num">{products.filter((p) => p.categoryId === c.id).length}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <input className="ai flt" style={{ width: 240, height: 40 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن منتج" />
      </div>

      {list.length ? (
        <div className="p-grid">
          {list.map((p) => {
            const same = products.filter((x) => x.categoryId === p.categoryId);
            const idx = same.sort((a, b) => a.sort - b.sort).findIndex((x) => x.id === p.id);
            return (
              <div key={p.id} className={'a-card p-card' + (!p.active ? ' off' : '')}>
                <Link href={`/admin/products/${p.id}`} className="img">
                  {p.images[0] ? <img src={p.images[0]} alt="" /> : <Cake size={44} weight="light" />}
                  <span className="flags">
                    {!p.active && <span className="pill plain st-cancelled">مخفي</span>}
                    {p.soldOut && <span className="pill plain st-new">نفد</span>}
                    {p.featured && (
                      <span className="pill plain st-preparing">
                        <Star size={12} weight="fill" /> مميز
                      </span>
                    )}
                  </span>
                  {p.images.length > 1 && (
                    <span className="pill plain" style={{ position: 'absolute', bottom: 10, insetInlineEnd: 10, background: 'rgba(43,27,22,.7)', color: '#FFF7F0' }}>
                      <Images size={13} /> {p.images.length}
                    </span>
                  )}
                </Link>
                <div className="bd">
                  <span className="faint small">{catName(p.categoryId)}</span>
                  <h3>{p.name.ar}</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <b className="num" style={{ fontSize: 16, color: 'var(--copper-text)' }}>{egp(p.price)}</b>
                    {p.compareAt ? <s className="faint small num">{egp(p.compareAt)}</s> : null}
                    <span style={{ flex: 1 }} />
                    {sales[p.id] ? <span className="small muted">المبيعات: {sales[p.id]}</span> : null}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 4 }}>
                    <div className="tgl-row" style={{ padding: '8px 0' }}>
                      <span className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.active ? <Eye size={16} /> : <EyeSlash size={16} />} ظاهر في الموقع
                      </span>
                      <Toggle on={p.active} onChange={(v) => patch(p, { active: v }, v ? 'المنتج ظاهر الآن' : 'تم إخفاء المنتج')} label="ظاهر" />
                    </div>
                    <div className="tgl-row" style={{ padding: '8px 0' }}>
                      <span className="small">متاح للطلب (لم ينفد)</span>
                      <Toggle on={!p.soldOut} onChange={(v) => patch(p, { soldOut: !v }, v ? 'المنتج متاح مرة أخرى' : 'تم تسجيل المنتج كنافد')} label="متاح" />
                    </div>
                  </div>
                  <div className="ft">
                    <Link href={`/admin/products/${p.id}`} className="ab soft sm" style={{ flex: 1 }}>
                      <PencilSimple size={15} /> تعديل
                    </Link>
                    {cat !== 'all' && (
                      <>
                        <button className="ab ghost sm icon" onClick={() => move(p, -1)} disabled={idx === 0} aria-label="تقديم" title="تقديم في الترتيب">
                          <ArrowUp size={14} />
                        </button>
                        <button className="ab ghost sm icon" onClick={() => move(p, 1)} disabled={idx === same.length - 1} aria-label="تأخير" title="تأخير في الترتيب">
                          <ArrowDown size={14} />
                        </button>
                      </>
                    )}
                    <button className="ab danger sm icon" onClick={() => del(p)} aria-label="حذف">
                      <Trash size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <Link href="/admin/products/new" className="a-card" style={{ display: 'grid', placeItems: 'center', minHeight: 280, border: '2px dashed rgba(185,126,94,.4)', background: 'transparent', boxShadow: 'none', color: 'var(--copper-text)', fontWeight: 600 }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Plus size={30} />
              أضف منتجًا
            </span>
          </Link>
        </div>
      ) : (
        <div className="a-card">
          <Empty icon={<Cake size={30} />} title="لا توجد منتجات هنا">
            <Link href="/admin/products/new" className="ab primary sm">
              أضف أول منتج
            </Link>
          </Empty>
        </div>
      )}
      {cat !== 'all' && <p className="faint small" style={{ marginTop: 12 }}>الترتيب هنا هو نفسه ترتيب المنتجات في منيو الموقع.</p>}

      <CategoriesModal
        open={catsOpen}
        onClose={() => setCatsOpen(false)}
        cats={cats}
        counts={Object.fromEntries(cats.map((c) => [c.id, products.filter((p) => p.categoryId === c.id).length]))}
        onSaved={(c) => {
          setCats(c);
          router.refresh();
        }}
      />
    </>
  );
}

function CategoriesModal({ open, onClose, cats, counts, onSaved }: { open: boolean; onClose: () => void; cats: Category[]; counts: Record<string, number>; onSaved: (c: Category[]) => void }) {
  const { toast } = useAdmin();
  const [list, setList] = useState(cats);
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const saved = await api<Category[]>('/api/admin/categories', 'PUT', list);
      onSaved(saved);
      toast('تم حفظ الأقسام');
      onClose();
    } catch {
      toast('تعذّر الحفظ، حاول مرة أخرى', true);
    }
    setBusy(false);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="أقسام المنيو"
      width={620}
      footer={
        <>
          <button className="ab ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="ab primary" onClick={save} disabled={busy}>
            حفظ
          </button>
        </>
      }
    >
      <p className="muted small" style={{ margin: 0 }}>تظهر الأقسام كتبويبات أعلى المنيو. اسحبها لتغيير ترتيبها. لا يمكن حذف قسم يحتوي على منتجات.</p>
      <div className="sortable">
        {list.map((c, i) => (
          <div
            key={c.id}
            className={'sort-row' + (drag === i ? ' drag' : '')}
            draggable
            onDragStart={() => setDrag(i)}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => {
              e.preventDefault();
              if (drag === null || drag === i) return;
              const a = [...list];
              const [m] = a.splice(drag, 1);
              a.splice(i, 0, m);
              setList(a);
              setDrag(i);
            }}
          >
            <span className="grip">
              <DotsSixVertical size={20} />
            </span>
            <div style={{ flex: 1 }}>
              <BiInput label="" value={c.name} onChange={(v) => setList((l) => l.map((x, k) => (k === i ? { ...x, name: v } : x)))} max={40} />
            </div>
            <button className="ab danger sm icon" disabled={!!counts[c.id]} title={counts[c.id] ? `يحتوي على ${arCount(counts[c.id], 'product')}` : 'حذف'} onClick={() => setList((l) => l.filter((_, k) => k !== i))} aria-label="حذف القسم">
              <Trash size={15} />
            </button>
          </div>
        ))}
      </div>
      <button className="ab soft" onClick={() => setList((l) => [...l, { id: 'cat-' + Date.now().toString(36), name: { ar: '', en: '' }, sort: l.length }])}>
        <Plus size={16} /> قسم جديد
      </button>
    </Modal>
  );
}
