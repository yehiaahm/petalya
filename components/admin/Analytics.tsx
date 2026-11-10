'use client';

import { useState } from 'react';
import { DeviceMobile, Desktop, DeviceTablet, Eye, ShoppingBagOpen, WhatsappLogo } from '@phosphor-icons/react';
import type { Stats } from '@/lib/stats';
import { AreaChart, BarList, Donut, Funnel } from './charts';
import { Empty, PageHeader } from './ui';

const WA_SRC: Record<string, string> = { fab: 'الزرار العائم', gallery: 'معرض الشغل', header: 'الهيدر', builder: 'صمّم تورتتك', contact: 'قسم التواصل', links: 'صفحة اللينكات', menu: 'القائمة' };
const DEV: Record<string, [string, string]> = { mobile: ['موبايل', '#C9776A'], desktop: ['كمبيوتر', '#9A6244'], tablet: ['تابلت', '#E2B08C'] };

export function Analytics({ s, names }: { s: Stats; names: Record<string, string> }) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const series = s.series.slice(-range);
  const totalViews = s.devices.reduce((a, d) => a + d.v, 0);
  const mobile = s.devices.find((d) => d.k === 'mobile')?.v ?? 0;
  return (
    <>
      <PageHeader title="الزيارات والتحليلات" sub={`مين بيزور الموقع، جايين منين، وبيعملوا إيه · آخر ${s.days} يوم`}>
        <div className="a-tabs">
          {([7, 30, 90] as const).map((r) => (
            <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
              {r} يوم
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="kpis">
        <div className="a-card kpi">
          <div className="top">
            <span className="lbl">زوّار</span>
            <span className="ic">
              <Eye size={20} />
            </span>
          </div>
          <span className="val">{s.visitors.v.toLocaleString('en-US')}</span>
          <div className="foot">{totalViews.toLocaleString('en-US')} مشاهدة صفحة</div>
        </div>
        <div className="a-card kpi">
          <div className="top">
            <span className="lbl">معدل التحويل</span>
            <span className="ic">
              <ShoppingBagOpen size={20} />
            </span>
          </div>
          <span className="val num">{s.conversion}%</span>
          <div className="foot">من الزوّار عملوا طلب</div>
        </div>
        <div className="a-card kpi">
          <div className="top">
            <span className="lbl">ضغطات واتساب</span>
            <span className="ic">
              <WhatsappLogo size={20} />
            </span>
          </div>
          <span className="val">{s.wa.reduce((a, w) => a + w.v, 0)}</span>
          <div className="foot">عملاء فتحوا محادثة مباشرة</div>
        </div>
        <div className="a-card kpi">
          <div className="top">
            <span className="lbl">من الموبايل</span>
            <span className="ic">
              <DeviceMobile size={20} />
            </span>
          </div>
          <span className="val num">{totalViews ? Math.round((mobile / totalViews) * 100) : 0}%</span>
          <div className="foot">من الزيارات</div>
        </div>
      </div>

      <div className="a-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', marginTop: 16 }}>
        <div className="a-card" style={{ gridColumn: '1 / -1' }}>
          <div className="hd">
            <div>
              <h2>الزيارات اليومية</h2>
              <span className="sub">زوّار مختلفين كل يوم</span>
            </div>
          </div>
          <div style={{ padding: '10px 16px 18px' }}>
            <AreaChart data={series} valueKey="visitors" format={(n) => `${n} زائر`} color="#C9776A" />
          </div>
        </div>
        <div className="a-card">
          <div className="hd">
            <h2>رحلة الزائر</h2>
          </div>
          <div className="a-pad">
            <Funnel steps={s.funnel} />
          </div>
        </div>
        <div className="a-card">
          <div className="hd">
            <h2>الزوّار جايين منين؟</h2>
          </div>
          <div className="a-pad">{s.sources.length ? <BarList rows={s.sources} format={(n) => n.toLocaleString('en-US')} /> : <Empty icon={<Eye size={28} />} title="لسه مفيش زيارات" />}</div>
        </div>
        <div className="a-card">
          <div className="hd">
            <h2>الأجهزة</h2>
          </div>
          <div className="a-pad">
            {s.devices.length ? (
              <Donut
                parts={s.devices.map((d) => ({ label: DEV[d.k]?.[0] ?? d.k, value: d.v, color: DEV[d.k]?.[1] ?? '#ccc' }))}
                center={
                  <span style={{ display: 'flex', gap: 4, color: 'var(--copper-icon)' }}>
                    <DeviceMobile size={22} />
                    <DeviceTablet size={22} />
                    <Desktop size={22} />
                  </span>
                }
              />
            ) : (
              <Empty icon={<DeviceMobile size={28} />} title="مفيش بيانات" />
            )}
          </div>
        </div>
        <div className="a-card">
          <div className="hd">
            <h2>واتساب اتضغط منين؟</h2>
          </div>
          <div className="a-pad">{s.wa.length ? <BarList rows={s.wa.map((w) => ({ k: WA_SRC[w.k] ?? w.k, v: w.v }))} /> : <Empty icon={<WhatsappLogo size={28} />} title="مفيش ضغطات لسه" />}</div>
        </div>
        <div className="a-card">
          <div className="hd">
            <h2>أكتر حاجات اتضافت للسلة</h2>
          </div>
          <div className="a-pad">{s.added.length ? <BarList rows={s.added.map((a) => ({ k: a.k === 'custom-cake' ? 'تورتة مخصوصة' : names[a.k] ?? a.k, v: a.v }))} /> : <Empty icon={<ShoppingBagOpen size={28} />} title="مفيش لسه" />}</div>
        </div>
      </div>
    </>
  );
}
