'use client';

import { useId, useMemo, useRef, useState } from 'react';

const shortDay = (d: string) => new Date(d + 'T12:00').toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
const longDay = (d: string) => new Date(d + 'T12:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

/** Daily bars — reads better than a line when many days are zero (sales, order counts). */
export function BarChart({ data, valueKey, format, height = 230 }: { data: Record<string, number | string>[]; valueKey: string; format: (n: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(1, ...vals) * 1.1;
  const n = data.length, step = Math.max(1, Math.round(n / 6));
  const gap = n > 45 ? 2 : n > 14 ? 4 : 10;
  return (
    <div className="chart bars" dir="ltr" onPointerLeave={() => setHover(null)}>
      <div className="plot" style={{ height, gap }}>
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <span key={k} className="grid" style={{ bottom: `${(k / 1.1) * 100}%` }} />
        ))}
        {vals.map((v, i) => (
          <div key={String(data[i].day)} className={'col' + (hover === i ? ' on' : '')} onPointerEnter={() => setHover(i)}>
            <i style={{ height: v ? `max(3px, ${(v / max) * 100}%)` : 0, animationDelay: `${Math.min(i * 12, 500)}ms` }} />
          </div>
        ))}
        {hover != null && (
          <div className="tip" style={{ left: `${((hover + 0.5) / n) * 100}%`, bottom: `calc(${(vals[hover] / max) * 100}% + 12px)`, transform: 'translateX(-50%)' }} dir="rtl">
            <b className="num">{format(vals[hover])}</b>
            {longDay(String(data[hover].day))}
          </div>
        )}
      </div>
      <div className="axis">
        {data.map((d, i) =>
          i % step === 0 || i === n - 1 ? (
            <span key={i} style={{ left: `${((i + 0.5) / n) * 100}%` }}>
              {shortDay(String(d.day))}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** Area chart over daily data. Time always runs left → right, even in the RTL dashboard. */
export function AreaChart({ data, valueKey, format, height = 230, color = '#9A6244', compareKey, compareColor = '#E8A398' }: { data: Record<string, number | string>[]; valueKey: string; format: (n: number) => string; height?: number; color?: string; compareKey?: string; compareColor?: string }) {
  const W = 720, H = height, P = { t: 14, r: 10, b: 26, l: 10 };
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const vals = data.map((d) => Number(d[valueKey]) || 0);
  const cmp = compareKey ? data.map((d) => Number(d[compareKey]) || 0) : [];
  const max = Math.max(1, ...vals) * 1.12;
  const cmax = compareKey ? Math.max(1, ...cmp) * 1.12 : 1;
  const x = (i: number) => P.l + (i / Math.max(1, data.length - 1)) * (W - P.l - P.r);
  const y = (v: number, m = max) => P.t + (1 - v / m) * (H - P.t - P.b);
  const path = (arr: number[], m: number) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v, m).toFixed(1)}`).join(' ');
  const smooth = (arr: number[], m: number) => {
    if (arr.length < 3) return path(arr, m);
    let d = `M${x(0)},${y(arr[0], m)}`;
    for (let i = 1; i < arr.length; i++) {
      const x0 = x(i - 1), y0 = y(arr[i - 1], m), x1 = x(i), y1 = y(arr[i], m), cx = (x0 + x1) / 2;
      d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
    }
    return d;
  };
  const line = smooth(vals, max);
  const area = `${line} L${x(vals.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
  const ticks = useMemo(() => {
    const n = data.length, step = Math.max(1, Math.round(n / 6));
    return data.map((d, i) => ({ i, label: String(d.day) })).filter((t) => t.i % step === 0 || t.i === n - 1);
  }, [data]);
  const id = 'g' + useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const onMove = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const hv = hover != null ? vals[hover] : 0;

  return (
    <div className="chart" ref={box} onPointerMove={onMove} onPointerLeave={() => setHover(null)} dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H }}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <line key={k} x1={P.l} x2={W - P.r} y1={y(max * k)} y2={y(max * k)} stroke="rgba(185,126,94,.14)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill={`url(#${id})`} />
        {compareKey && <path d={smooth(cmp, cmax)} fill="none" stroke={compareColor} strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />}
        <path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover != null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="rgba(74,44,34,.25)" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(hv)} r="5" fill="#FFFCF8" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <div style={{ position: 'relative', height: 18, marginTop: -18, fontSize: 11.5, color: 'var(--ink-faint)' }}>
        {ticks.map((t) => (
          <span key={t.i} style={{ position: 'absolute', left: `${(x(t.i) / W) * 100}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
            {new Date(t.label + 'T12:00').toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
          </span>
        ))}
      </div>
      {hover != null && (
        <div className="tip" style={{ left: `${(x(hover) / W) * 100}%`, top: (y(hv) / H) * H - 10 }} dir="rtl">
          <b className="num">{format(hv)}</b>
          {new Date(String(data[hover].day) + 'T12:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
          {compareKey && <div style={{ color: '#F2C6BD' }}>{cmp[hover]} زيارة</div>}
        </div>
      )}
    </div>
  );
}

export function Donut({ parts, size = 168, center }: { parts: { label: string; value: number; color: string }[]; size?: number; center?: React.ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const R = 70, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
        <svg viewBox="0 0 180 180" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="90" cy="90" r={R} fill="none" stroke="#F3E7DF" strokeWidth="20" />
          {parts.map((p) => {
            const len = (p.value / total) * C;
            const el = <circle key={p.label} cx="90" cy="90" r={R} fill="none" stroke={p.color} strokeWidth="20" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-off} strokeLinecap="butt" />;
            off += len;
            return el;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{center}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 140 }}>
        {parts.map((p) => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: p.color, flex: 'none' }} />
            <span style={{ flex: 1 }}>{p.label}</span>
            <b className="num" style={{ fontWeight: 600 }}>{p.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BarList({ rows, format = (n) => String(n) }: { rows: { k: string; v: number; sub?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return (
    <div className="barlist">
      {rows.map((r, i) => (
        <div key={r.k} className="r">
          <div className="t">
            <span>
              {r.k}
              {r.sub && <span className="faint small"> · {r.sub}</span>}
            </span>
            <b className="num" style={{ fontWeight: 600 }}>{format(r.v)}</b>
          </div>
          <div className="bar">
            <i style={{ width: `${(r.v / max) * 100}%`, animationDelay: `${i * 70}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Funnel({ steps }: { steps: { k: string; v: number }[] }) {
  const max = Math.max(1, steps[0]?.v || 1);
  return (
    <div className="funnel">
      {steps.map((s, i) => (
        <div key={s.k} className="st">
          <i style={{ width: s.v ? `${Math.max(4, (s.v / max) * 100)}%` : 0, animationDelay: `${i * 90}ms` }} />
          <span>{s.k}</span>
          <span className="num" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
            {i > 0 && steps[i - 1].v > 0 && <span className="faint small ltr" style={{ fontWeight: 500 }}>{Math.round((s.v / steps[i - 1].v) * 100)}%</span>}
            <span>{s.v.toLocaleString('en-US')}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function Spark({ values, color = '#F2C6BD', width = 110, height = 34 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * width).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ direction: 'ltr' }} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
