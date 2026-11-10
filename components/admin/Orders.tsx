'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CalendarBlank, DownloadSimple, Moped, Receipt, Storefront, X } from '@phosphor-icons/react';
import type { Order, OrderStatus } from '@/lib/types';
import { dayLabel, egp, Empty, relTime, StatusPill } from './ui';

const TABS: { k: 'all' | 'active' | OrderStatus; label: string }[] = [
  { k: 'active', label: 'شغالة' },
  { k: 'new', label: 'جديدة' },
  { k: 'confirmed', label: 'اتأكدت' },
  { k: 'preparing', label: 'بتتحضّر' },
  { k: 'ready', label: 'جاهزة' },
  { k: 'out_for_delivery', label: 'في الطريق' },
  { k: 'delivered', label: 'اتسلّمت' },
  { k: 'cancelled', label: 'اتلغت' },
  { k: 'all', label: 'الكل' },
];

const ACTIVE: OrderStatus[] = ['new', 'confirmed', 'preparing', 'ready', 'out_for_delivery'];

export function Orders({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useState<string>(sp.get('status') || (sp.get('q') || sp.get('date') || sp.get('phone') ? 'all' : 'active'));
  const [q, setQ] = useState(sp.get('q') || sp.get('phone') || '');
  const [date, setDate] = useState(sp.get('date') || '');
  const [type, setType] = useState<'' | 'delivery' | 'pickup'>('');
  const [sort, setSort] = useState<'created' | 'due'>(sp.get('date') ? 'due' : 'created');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length, active: 0 };
    orders.forEach((o) => {
      c[o.status] = (c[o.status] || 0) + 1;
      if (ACTIVE.includes(o.status)) c.active++;
    });
    return c;
  }, [orders]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders
      .filter((o) => (tab === 'all' ? true : tab === 'active' ? ACTIVE.includes(o.status) : o.status === tab))
      .filter((o) => !date || o.fulfillment.date === date)
      .filter((o) => !type || o.fulfillment.type === type)
      .filter((o) => !needle || o.code.toLowerCase().includes(needle) || o.customer.name.toLowerCase().includes(needle) || o.customer.phone.includes(needle.replace(/\D/g, '') || '§'))
      .sort((a, b) => (sort === 'due' ? a.fulfillment.date.localeCompare(b.fulfillment.date) : b.createdAt.localeCompare(a.createdAt)));
  }, [orders, tab, q, date, type, sort]);

  const total = list.filter((o) => o.status !== 'cancelled').reduce((a, o) => a + o.total, 0);

  return (
    <>
      <div className="a-ph">
        <div>
          <h1>الطلبات</h1>
          <p>
            {list.length} طلب · {egp(total)}
          </p>
        </div>
        <div className="acts">
          <a href="/api/admin/orders/export" className="ab ghost">
            <DownloadSimple size={18} />
            تصدير Excel
          </a>
        </div>
      </div>

      <div className="a-tabs scroll-sm" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.k} className={tab === t.k ? 'on' : ''} onClick={() => setTab(t.k)}>
            {t.label}
            {(counts[t.k] || 0) > 0 && <span className="c num">{counts[t.k]}</span>}
          </button>
        ))}
      </div>

      <div className="a-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14, borderBottom: '1px solid var(--line)' }}>
          <input className="ai" style={{ flex: '1 1 220px', height: 40 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث برقم الطلب أو الاسم أو الموبايل" />
          <div className="flt-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarBlank size={18} color="#B97E5E" />
            <input type="date" className="ai flt" style={{ height: 40, width: 160 }} value={date} onChange={(e) => setDate(e.target.value)} aria-label="يوم التسليم" />
            {date && (
              <button className="ab ghost sm icon" onClick={() => setDate('')} aria-label="مسح التاريخ">
                <X size={14} />
              </button>
            )}
          </div>
          <select className="ai flt" style={{ height: 40, width: 150 }} value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="النوع">
            <option value="">توصيل واستلام</option>
            <option value="delivery">توصيل بس</option>
            <option value="pickup">استلام بس</option>
          </select>
          <select className="ai flt" style={{ height: 40, width: 170 }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="الترتيب">
            <option value="created">الأحدث أولاً</option>
            <option value="due">الأقرب في التسليم</option>
          </select>
        </div>
        <div className="tbl-wrap">
          {list.length ? (
            <table className="tbl cards">
              <thead>
                <tr>
                  <th>الطلب</th>
                  <th>العميل</th>
                  <th className="hide-md">المنتجات</th>
                  <th>التسليم</th>
                  <th>الإجمالي</th>
                  <th className="hide-md">الدفع</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {list.map((o) => {
                  const n = o.items.reduce((a, i) => a + i.qty, 0);
                  const late = ACTIVE.includes(o.status) && o.fulfillment.date < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={o.id} className={'click' + (!o.seen ? ' unseen' : '')} onClick={() => router.push(`/admin/orders/${o.id}`)}>
                      <td className="c-code">
                        <Link href={`/admin/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="ltr num" style={{ fontWeight: 700, color: 'var(--cocoa)' }}>
                          {o.code}
                        </Link>
                        <div className="faint small">
                          {relTime(o.createdAt)}
                          {!o.seen && <b style={{ color: '#C9776A', marginInlineStart: 6 }}>• جديد</b>}
                        </div>
                      </td>
                      <td className="c-cust">
                        <div className="who">
                          <span className="av">{o.customer.name.charAt(0)}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{o.customer.name}</div>
                            <div className="faint small ltr num" style={{ textAlign: 'right' }}>
                              {o.customer.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hide-md" style={{ maxWidth: 240 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.items.map((i) => i.name.ar).join('، ')}</div>
                        <div className="faint small">
                          {n} قطعة{o.items.some((i) => i.kind === 'custom') && <span style={{ color: 'var(--copper-text)', fontWeight: 600 }}> · فيها تورتة مخصوصة</span>}
                        </div>
                      </td>
                      <td className="c-due">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: late ? 'var(--bad)' : undefined, fontWeight: late ? 600 : undefined }}>
                          {o.fulfillment.type === 'delivery' ? <Moped size={16} /> : <Storefront size={16} />}
                          {dayLabel(o.fulfillment.date)}
                        </div>
                        <div className="faint small">{o.fulfillment.type === 'delivery' ? o.fulfillment.zoneName?.ar : 'استلام من المطبخ'}</div>
                      </td>
                      <td className="num c-total" style={{ fontWeight: 700 }}>
                        {egp(o.total)}
                      </td>
                      <td className="hide-md">
                        <span className={'pill plain ' + (o.payment.status === 'paid' ? 'pay-paid' : 'pay-unpaid')}>{o.payment.status === 'paid' ? 'مدفوع' : o.payment.method === 'cod' ? 'كاش' : o.payment.method === 'instapay' ? 'إنستاباي' : 'محفظة'}</span>
                      </td>
                      <td className="c-status">
                        <StatusPill s={o.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty icon={<Receipt size={30} />} title="مفيش طلبات هنا">
              <span className="small">جرّب تغيّر الفلتر أو البحث.</span>
            </Empty>
          )}
        </div>
      </div>
    </>
  );
}
