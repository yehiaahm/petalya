'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, CalendarBlank, Cake, ChartLineUp, CurrencyCircleDollar, Eye, Hourglass, Receipt, Sparkle, TrendDown, TrendUp, Users } from '@phosphor-icons/react';
import type { Stats } from '@/lib/stats';
import type { Order } from '@/lib/types';
import { AreaChart, BarChart, BarList, Donut, Funnel, Spark } from './charts';
import { api, dayLabel, egp, Empty, relTime, StatusPill, useAdmin } from './ui';

const STATUS_COLORS: Record<string, [string, string]> = {
  new: ['طلبات جديدة', '#E8A398'],
  confirmed: ['اتأكدت', '#7F9CC0'],
  preparing: ['بتتحضّر', '#D9A34A'],
  ready: ['جاهزة', '#A98BC4'],
  out_for_delivery: ['في الطريق', '#6FAFAF'],
  delivered: ['اتسلّمت', '#8FAE6E'],
  cancelled: ['اتلغت', '#BFB1A9'],
};

function Delta({ d }: { d: number }) {
  return (
    <span className={'delta' + (d < 0 ? ' down' : '')}>
      {d < 0 ? <TrendDown size={13} weight="bold" /> : <TrendUp size={13} weight="bold" />}
      <span className="num ltr">{Math.abs(d)}%</span>
    </span>
  );
}

export function Overview({ s, recent, hasDemo, empty }: { s: Stats; recent: Order[]; hasDemo: boolean; empty: boolean }) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [metric, setMetric] = useState<'revenue' | 'orders' | 'visitors'>('revenue');
  const router = useRouter();
  const { toast } = useAdmin();
  const [loading, setLoading] = useState(false);
  const series = s.series.slice(-range);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'صباح الخير' : hour < 18 ? 'نهارك سعيد' : 'مساء الخير';
  const statusParts = Object.entries(STATUS_COLORS)
    .map(([k, [label, color]]) => ({ label, color, value: s.statusCounts[k] || 0 }))
    .filter((p) => p.value > 0);

  const loadDemo = async () => {
    setLoading(true);
    await api('/api/admin/demo', 'POST', { action: 'load' });
    toast('اتضافت بيانات تجريبية — تقدر تمسحها من الإعدادات');
    router.refresh();
    setLoading(false);
  };

  return (
    <>
      <div className="a-ph">
        <div>
          <h1>{greet} 👋</h1>
          <p>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
            {s.todayOrders ? `${s.todayOrders} طلب النهارده بقيمة ${egp(s.todayRevenue)}` : 'لسه مفيش طلبات النهارده'}
          </p>
        </div>
        <div className="acts">
          <Link href="/admin/products/new" className="ab ghost">
            <Cake size={18} />
            منتج جديد
          </Link>
          <Link href="/admin/orders" className="ab primary">
            <Receipt size={18} />
            كل الطلبات
          </Link>
        </div>
      </div>

      {empty && !hasDemo && (
        <div className="a-card a-pad" style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', background: 'radial-gradient(80% 140% at 100% 0%, rgba(242,198,189,.5), transparent 60%), var(--paper)' }}>
          <span className="kpi" style={{ padding: 0 }}>
            <span className="ic dark">
              <Sparkle size={22} weight="fill" />
            </span>
          </span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <b style={{ fontSize: 16 }}>لوحة التحكم جاهزة — مستنية أول طلب</b>
            <p className="muted" style={{ margin: '2px 0 0' }}>عايز تشوف شكلها وهي مليانة؟ ضيف بيانات تجريبية وامسحها بضغطة من الإعدادات.</p>
          </div>
          <button className="ab rose" onClick={loadDemo} disabled={loading}>
            {loading ? 'لحظة…' : 'جرّب ببيانات تجريبية'}
          </button>
        </div>
      )}

      <div className="kpis">
        <div className="a-card kpi kpi-hero">
          <div className="top">
            <span className="lbl">المبيعات · آخر {s.days} يوم</span>
            <Delta d={s.revenue.d} />
          </div>
          <span className="val">
            {Math.round(s.revenue.v).toLocaleString('en-US')}
            <small>ج.م</small>
          </span>
          <div className="foot" style={{ justifyContent: 'space-between' }}>
            <span>مقارنة بالـ {s.days} يوم اللي قبلهم</span>
            <Spark values={s.series.slice(-s.days).map((d) => d.revenue)} />
          </div>
        </div>
        <div className="a-card kpi">
          <div className="top">
            <span className="lbl">الطلبات</span>
            <span className="ic">
              <Receipt size={20} />
            </span>
          </div>
          <span className="val">{s.orders.v}</span>
          <div className="foot">
            <Delta d={s.orders.d} />
            عن الفترة اللي فاتت
          </div>
        </div>
        <div className="a-card kpi">
          <div className="top">
            <span className="lbl">متوسط قيمة الطلب</span>
            <span className="ic">
              <CurrencyCircleDollar size={20} />
            </span>
          </div>
          <span className="val">
            {s.aov.v.toLocaleString('en-US')}
            <small>ج.م</small>
          </span>
          <div className="foot">
            <Delta d={s.aov.d} />
          </div>
        </div>
        <div className="a-card kpi">
          <div className="top">
            <span className="lbl">الزوّار</span>
            <span className="ic">
              <Eye size={20} />
            </span>
          </div>
          <span className="val">{s.visitors.v.toLocaleString('en-US')}</span>
          <div className="foot">
            <Delta d={s.visitors.d} />
            معدل التحويل <b className="num ltr" style={{ color: 'var(--cocoa)' }}>{s.conversion}%</b>
          </div>
        </div>
      </div>

      <div className="a-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', marginTop: 16 }}>
        <div className="a-card" style={{ gridColumn: '1 / -1' }}>
          <div className="hd" style={{ flexWrap: 'wrap' }}>
            <div>
              <h2>{metric === 'revenue' ? 'المبيعات' : metric === 'orders' ? 'عدد الطلبات' : 'الزيارات'}</h2>
              <span className="sub">
                {metric === 'revenue' ? egp(series.reduce((a, d) => a + d.revenue, 0)) : series.reduce((a, d) => a + d[metric], 0).toLocaleString('en-US')} في آخر {range} يوم
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div className="a-tabs">
                {(['revenue', 'orders', 'visitors'] as const).map((m) => (
                  <button key={m} className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>
                    {m === 'revenue' ? 'مبيعات' : m === 'orders' ? 'طلبات' : 'زيارات'}
                  </button>
                ))}
              </div>
              <div className="a-tabs">
                {([7, 30, 90] as const).map((r) => (
                  <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
                    {r} يوم
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding: '10px 16px 18px' }}>
            {metric === 'visitors' ? <AreaChart data={series} valueKey="visitors" format={(n) => `${n} زيارة`} color="#C9776A" /> : <BarChart key={metric + range} data={series} valueKey={metric} format={(n) => (metric === 'revenue' ? egp(n) : `${n} طلب`)} />}
          </div>
        </div>

        <div className="a-card">
          <div className="hd">
            <div>
              <h2>جدول الأسبوع</h2>
              <span className="sub">طلبات لازم تتسلّم في الـ ٧ أيام الجاية</span>
            </div>
            <CalendarBlank size={22} color="#B97E5E" />
          </div>
          <div className="a-pad">
            <div className="days">
              {s.upcoming.map((d, i) => (
                <button key={d.day} className={'day' + (i === 0 ? ' today' : '')} onClick={() => router.push(`/admin/orders?date=${d.day}`)}>
                  <span className="w">{i === 0 ? 'النهارده' : i === 1 ? 'بكرة' : dayLabel(d.day, { weekday: 'short' })}</span>
                  <span className="d">{new Date(d.day + 'T12:00').getDate()}</span>
                  <span className={'n' + (d.count ? ' has' : '')}>{d.count ? `${d.count} طلب` : '—'}</span>
                </button>
              ))}
            </div>
            {s.unpaid > 0 && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 13.5 }}>
                <Hourglass size={18} />
                فيه <b className="num">{egp(s.unpaid)}</b> لسه متحصّلتش من طلبات متأكدة
              </div>
            )}
          </div>
        </div>

        <div className="a-card">
          <div className="hd">
            <div>
              <h2>حالة الطلبات</h2>
              <span className="sub">كل الطلبات من البداية</span>
            </div>
          </div>
          <div className="a-pad">
            {statusParts.length ? (
              <Donut
                parts={statusParts}
                center={
                  <div>
                    <b className="num" style={{ fontSize: 26, display: 'block', lineHeight: 1 }}>
                      {statusParts.reduce((a, p) => a + p.value, 0)}
                    </b>
                    <span className="small muted">طلب</span>
                  </div>
                }
              />
            ) : (
              <Empty icon={<Receipt size={30} />} title="لسه مفيش طلبات" />
            )}
          </div>
        </div>

        <div className="a-card">
          <div className="hd">
            <div>
              <h2>الأكثر مبيعًا</h2>
              <span className="sub">آخر {s.days} يوم، حسب الإيراد</span>
            </div>
            <Link href="/admin/products" className="small">
              المنتجات
            </Link>
          </div>
          <div className="a-pad">{s.top.length ? <BarList rows={s.top.map((t) => ({ k: t.name, v: t.revenue, sub: `${t.qty} قطعة` }))} format={egp} /> : <Empty icon={<Cake size={30} />} title="مفيش مبيعات في الفترة دي" />}</div>
        </div>

        <div className="a-card">
          <div className="hd">
            <div>
              <h2>رحلة الزائر</h2>
              <span className="sub">من أول زيارة لحد الطلب · آخر {s.days} يوم</span>
            </div>
            <Link href="/admin/analytics" className="small">
              التفاصيل
            </Link>
          </div>
          <div className="a-pad">
            <Funnel steps={s.funnel} />
          </div>
        </div>

        <div className="a-card" style={{ gridColumn: '1 / -1' }}>
          <div className="hd">
            <div>
              <h2>أحدث الطلبات</h2>
              <span className="sub">{s.customers} عميل طلبوا من الموقع</span>
            </div>
            <Link href="/admin/orders" className="ab ghost sm">
              عرض الكل
              <ArrowLeft size={14} />
            </Link>
          </div>
          <div className="tbl-wrap" style={{ marginTop: 10 }}>
            {recent.length ? (
              <table className="tbl cards">
                <thead>
                  <tr>
                    <th>الطلب</th>
                    <th>العميل</th>
                    <th>التسليم</th>
                    <th>الإجمالي</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id} className={'click' + (!o.seen ? ' unseen' : '')} onClick={() => router.push(`/admin/orders/${o.id}`)}>
                      <td className="c-code">
                        <b className="ltr num" style={{ fontWeight: 600 }}>{o.code}</b>
                        <div className="faint small">{relTime(o.createdAt)}</div>
                      </td>
                      <td className="c-cust">
                        <div className="who">
                          <span className="av">{o.customer.name.charAt(0)}</span>
                          <span>{o.customer.name}</span>
                        </div>
                      </td>
                      <td className="c-due">
                        {dayLabel(o.fulfillment.date)}
                        <div className="faint small">{o.fulfillment.type === 'delivery' ? o.fulfillment.zoneName?.ar : 'استلام'}</div>
                      </td>
                      <td className="num c-total" style={{ fontWeight: 600 }}>
                        {egp(o.total)}
                      </td>
                      <td className="c-status">
                        <StatusPill s={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty icon={<Users size={30} />} title="أول طلب هيظهر هنا">
                <span className="small">ابعت لينك الموقع لعملائك على إنستجرام — <Link href="/links">صفحة اللينكات</Link> جاهزة للبايو.</span>
              </Empty>
            )}
          </div>
        </div>
      </div>
      <p className="faint small" style={{ textAlign: 'center', marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
        <ChartLineUp size={14} />
        الأرقام بتتحدّث لحظيًا مع كل طلب وزيارة
      </p>
    </>
  );
}
