'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, CheckCircle, ImageSquare, Star, Trash, UploadSimple, Warning, X } from '@phosphor-icons/react';
import type { L, OrderStatus } from '@/lib/types';
import { STATUS_LABEL } from '@/lib/pricing';

/* ---------- context: toast + api ---------- */
type Ctx = { toast: (m: string, err?: boolean) => void };
const AdminCtx = createContext<Ctx>({ toast: () => {} });
export const useAdmin = () => useContext(AdminCtx);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<{ m: string; err: boolean; k: number } | null>(null);
  const toast = useCallback((m: string, err = false) => setT({ m, err, k: Date.now() }), []);
  useEffect(() => {
    if (!t) return;
    const id = setTimeout(() => setT(null), 2600);
    return () => clearTimeout(id);
  }, [t]);
  const last = useRef({ m: '', err: false });
  if (t) last.current = t;
  return (
    <AdminCtx.Provider value={{ toast }}>
      {children}
      <div className={'a-toast' + (t ? ' show' : '') + (last.current.err ? ' err' : '')} role="status">
        {last.current.err ? <Warning size={18} /> : <CheckCircle size={18} weight="fill" color="#F2C6BD" />}
        {last.current.m}
      </div>
    </AdminCtx.Provider>
  );
}

export async function api<T = unknown>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  if (r.status === 401) {
    location.href = '/admin/login';
    throw new Error('unauthorized');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((j as { error?: string }).error || 'error'), { status: r.status, body: j });
  return j as T;
}

export const egp = (n: number) => `${Math.round(n).toLocaleString('en-US')} ج.م`;
export const ar = (l?: L | null) => l?.ar || l?.en || '';

export function relTime(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  // Arabic counting: 1 → singular, 2 → dual, 3–10 → plural, 11+ → singular.
  const say = (n: number, one: string, two: string, few: string) => (n === 1 ? `منذ ${one}` : n === 2 ? `منذ ${two}` : `منذ ${n} ${n <= 10 ? few : one}`);
  if (s < 60) return 'الآن';
  if (s < 3600) return say(Math.floor(s / 60), 'دقيقة', 'دقيقتين', 'دقائق');
  if (s < 86400) return say(Math.floor(s / 3600), 'ساعة', 'ساعتين', 'ساعات');
  const d = Math.floor(s / 86400);
  if (d === 1) return 'أمس';
  if (d < 7) return say(d, 'يوم', 'يومين', 'أيام');
  return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}
export const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => (d ? new Date(d.length <= 10 ? d + 'T12:00' : d).toLocaleDateString('ar-EG', opts) : '—');

/* ---------- primitives ---------- */
export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="a-ph">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="acts">{children}</div>}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={'tgl' + (on ? ' on' : '')} onClick={() => onChange(!on)} />;
}

export function StatusPill({ s }: { s: OrderStatus }) {
  return <span className={`pill st-${s}`}>{STATUS_LABEL[s].ar}</span>;
}

export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="ic">{icon}</span>
      <b style={{ fontSize: 16, color: 'var(--cocoa)' }}>{title}</b>
      {children}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, width = 520 }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ width: `min(100%, ${width}px)` }}>
        <div className="mh">
          <h3>{title}</h3>
          <button className="ab ghost sm icon" onClick={onClose} aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

export function useConfirm() {
  const [st, setSt] = useState<{ title: string; body: string; ok: string; resolve: (v: boolean) => void } | null>(null);
  const ask = (title: string, body: string, ok = 'حذف') => new Promise<boolean>((resolve) => setSt({ title, body, ok, resolve }));
  const close = (v: boolean) => {
    st?.resolve(v);
    setSt(null);
  };
  const node = (
    <Modal
      open={!!st}
      title={st?.title || ''}
      onClose={() => close(false)}
      footer={
        <>
          <button className="ab ghost" onClick={() => close(false)}>
            إلغاء
          </button>
          <button className="ab danger" onClick={() => close(true)} autoFocus>
            {st?.ok}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{st?.body}</p>
    </Modal>
  );
  return { ask, node };
}

export function Field({ label, children, hint }: { label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="af">
      <span>{label}</span>
      {children}
      {hint && <small className="muted small">{hint}</small>}
    </label>
  );
}

export function BiInput({ label, value, onChange, multiline = false, max }: { label: string; value: L; onChange: (v: L) => void; multiline?: boolean; max?: number }) {
  const C = multiline ? 'textarea' : 'input';
  return (
    <div className="af">
      <span>{label}</span>
      <div className="bi">
        <div style={{ position: 'relative' }}>
          <C className="ai" dir="rtl" value={value.ar} maxLength={max} onChange={(e) => onChange({ ...value, ar: e.target.value })} placeholder="بالعربية" rows={multiline ? 3 : undefined} />
        </div>
        <div>
          <C className="ai ltr" dir="ltr" value={value.en} maxLength={max} onChange={(e) => onChange({ ...value, en: e.target.value })} placeholder="In English" rows={multiline ? 3 : undefined} />
        </div>
      </div>
    </div>
  );
}

export function NumInput({ value, onChange, suffix, min = 0 }: { value: number | null | undefined; onChange: (n: number) => void; suffix?: string; min?: number }) {
  return (
    <div className="suffix">
      <input className="ai ltr num" type="number" inputMode="numeric" min={min} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
      {suffix && <em>{suffix}</em>}
    </div>
  );
}

/* ---------- images ---------- */

/** Downscale in the browser to WebP (≤1800px) before upload — keeps the site fast. */
async function prepare(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = 1800, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/webp', 0.86));
    return blob && blob.size < file.size * 1.2 ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadImage(file: File): Promise<string> {
  const blob = await prepare(file);
  const fd = new FormData();
  fd.append('file', blob, file.name.replace(/\.\w+$/, '') + (blob.type === 'image/webp' ? '.webp' : ''));
  const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'upload');
  return (await r.json()).url;
}

export function ImageManager({ images, onChange, max = 12, single = false }: { images: string[]; onChange: (v: string[]) => void; max?: number; single?: boolean }) {
  const { toast } = useAdmin();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const ref = useRef(images);
  ref.current = images;

  const add = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, single ? 1 : max - images.length);
    if (!list.length) return;
    setBusy((b) => b + list.length);
    for (const f of list) {
      try {
        const url = await uploadImage(f);
        onChange(single ? [url] : [...ref.current, url]);
      } catch {
        toast('تعذّر رفع «' + f.name + '»', true);
      }
      setBusy((b) => b - 1);
    }
  };
  const move = (i: number, d: number) => {
    const a = [...images];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(images.length > 0 || busy > 0) && (
        <div className="imgs" style={single ? { gridTemplateColumns: 'minmax(0, 220px)' } : undefined}>
          {images.map((src, i) => (
            <div key={src + i} className={'it' + (i === 0 && !single ? ' main' : '')}>
              <img src={src} alt="" />
              {i === 0 && !single && <span className="badge">الأساسية</span>}
              <div className="tools">
                {!single && (
                  <span style={{ display: 'flex', gap: 4 }}>
                    {i > 0 && (
                      <button type="button" onClick={() => move(i, -1)} aria-label="تقديم" title="تقديم">
                        <ArrowUp size={14} style={{ transform: 'rotate(90deg)' }} />
                      </button>
                    )}
                    {i > 0 && (
                      <button type="button" onClick={() => onChange([src, ...images.filter((_, k) => k !== i)])} aria-label="اجعلها الأساسية" title="اجعلها الأساسية">
                        <Star size={14} />
                      </button>
                    )}
                    {i < images.length - 1 && (
                      <button type="button" onClick={() => move(i, 1)} aria-label="تأخير" title="تأخير">
                        <ArrowDown size={14} style={{ transform: 'rotate(90deg)' }} />
                      </button>
                    )}
                  </span>
                )}
                <button type="button" onClick={() => onChange(images.filter((_, k) => k !== i))} aria-label="حذف الصورة" title="حذف" style={{ color: 'var(--bad)' }}>
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))}
          {Array.from({ length: busy }, (_, i) => (
            <div key={'b' + i} className="it busy" />
          ))}
        </div>
      )}
      {(single || images.length < max) && (
        <div
          className={'drop' + (over ? ' over' : '')}
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            add(e.dataTransfer.files);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {images.length ? <UploadSimple size={22} color="#B97E5E" /> : <Camera size={26} color="#B97E5E" />}
            <span>
              <b style={{ color: 'var(--cocoa)' }}>{single && images.length ? 'تغيير الصورة' : 'اسحب الصور إلى هنا'}</b> أو اضغط لاختيارها
            </span>
          </div>
          <small className="faint">JPG · PNG · WebP — نصغّر حجمها تلقائيًا ليبقى الموقع سريعًا</small>
          <input ref={input} type="file" accept="image/*" multiple={!single} hidden onChange={(e) => e.target.files && add(e.target.files)} />
        </div>
      )}
    </div>
  );
}

export function Thumb({ src, size = 44 }: { src?: string; size?: number }) {
  return <span className="thumb-sm" style={{ width: size, height: size }}>{src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageSquare size={20} />}</span>;
}
