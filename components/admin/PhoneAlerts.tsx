'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRinging, BellSlash, DownloadSimple, Export, PlusSquare } from '@phosphor-icons/react';
import { installApp, usePwa } from '@/components/pwa/pwa';
import { api, useAdmin } from './ui';

type Status = 'loading' | 'unsupported' | 'blocked' | 'off' | 'on';
type PushInfo = { key: string; devices: number; subscribed: boolean };

const HIDE_KEY = 'petalya.admin.alerts.hide';

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * The owner's "new order on my phone" switch: installs the dashboard as an app and turns on Web Push.
 * `always` keeps the card visible (Settings); otherwise it only shows while something is still to do.
 */
export function PhoneAlerts({ always = false }: { always?: boolean }) {
  const { toast } = useAdmin();
  const pwa = usePwa();
  const [status, setStatus] = useState<Status>('loading');
  const [devices, setDevices] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  const refresh = useCallback(async () => {
    if (!supported()) return setStatus('unsupported');
    if (Notification.permission === 'denied') return setStatus('blocked');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const info = await api<PushInfo>('/api/admin/push' + (sub ? '?endpoint=' + encodeURIComponent(sub.endpoint) : ''));
      setDevices(info.devices);
      if (sub && !info.subscribed) {
        // The browser still has the subscription but the server forgot it (e.g. restored backup): register it again.
        await api('/api/admin/push', 'POST', sub.toJSON());
        return setStatus('on');
      }
      setStatus(sub && info.subscribed ? 'on' : 'off');
    } catch {
      setStatus('off');
    }
  }, []);

  useEffect(() => {
    try {
      const t = Number(localStorage.getItem(HIDE_KEY));
      setHidden(!!t && Date.now() - t < 2 * 864e5);
    } catch {}
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setStatus(perm === 'denied' ? 'blocked' : 'off');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { key } = await api<PushInfo>('/api/admin/push');
      const opts = { userVisibleOnly: true, applicationServerKey: b64ToBytes(key) };
      let sub = await reg.pushManager.getSubscription();
      try {
        sub ||= await reg.pushManager.subscribe(opts);
      } catch {
        // An old subscription made with a different key blocks a new one.
        await (await reg.pushManager.getSubscription())?.unsubscribe();
        sub = await reg.pushManager.subscribe(opts);
      }
      const r = await api<{ devices: number }>('/api/admin/push', 'POST', sub.toJSON());
      setDevices(r.devices);
      setStatus('on');
      toast('تم تفعيل الإشعارات على هذا الجهاز');
      await api('/api/admin/push/test', 'POST');
    } catch {
      toast('تعذّر تفعيل الإشعارات', true);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (sub) {
        await api('/api/admin/push', 'DELETE', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setStatus('off');
      toast('تم إيقاف الإشعارات على هذا الجهاز');
    } catch {
      toast('حدث خطأ، حاول مرة أخرى', true);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const r = await api<{ sent: number }>('/api/admin/push/test', 'POST');
      toast(r.sent ? 'تم إرسال إشعار تجريبي' : 'لا يوجد جهاز مسجَّل', !r.sent);
    } catch {
      toast('تعذّر الإرسال', true);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now()));
    } catch {}
  };

  // iPhone/iPad only allow notifications for apps that were added to the home screen.
  const needsIosInstall = pwa.ios && !pwa.standalone;
  const canInstall = pwa.available && !needsIosInstall;
  const done = status === 'on' || status === 'loading' || (status === 'unsupported' && !needsIosInstall);
  if (!always && (hidden || (done && !canInstall))) return null;
  if (always && status === 'loading') return null;

  return (
    <div className="a-card a-pad phone-alerts">
      <span className={'ic' + (status === 'on' ? ' on' : '')}>{status === 'on' ? <BellRinging size={24} weight="fill" /> : <BellSlash size={24} />}</span>
      <div className="body">
        <b>{status === 'on' ? 'إشعارات الطلبات مفعّلة على موبايلك' : 'استقبل إشعارات الطلبات الجديدة على موبايلك'}</b>
        {status === 'on' && <p>سيصلك إشعار فور وصول أي طلب جديد، مثل رسائل واتساب، حتى لو كانت لوحة التحكم مغلقة.{devices > 1 ? ` (عدد الأجهزة المسجَّلة: ${devices})` : ''}</p>}
        {status === 'off' && <p>فعّل الإشعارات ليصلك تنبيه على الموبايل فور وصول أي طلب، دون الحاجة إلى فتح لوحة التحكم.</p>}
        {status === 'blocked' && <p>الإشعارات محظورة لهذا الموقع من إعدادات المتصفح. افتح إعدادات الموقع (رمز القفل بجوار العنوان)، واختر «السماح» للإشعارات، ثم عُد إلى هنا.</p>}
        {status === 'unsupported' && !needsIosInstall && <p>هذا المتصفح لا يدعم الإشعارات. جرّب Chrome على أندرويد، أو Safari على آيفون بعد إضافة التطبيق إلى الشاشة الرئيسية.</p>}
        {needsIosInstall && (
          <p>
            على آيفون، أضف لوحة التحكم إلى الشاشة الرئيسية أولًا: اضغط <Export size={15} weight="bold" style={{ verticalAlign: '-2px' }} /> مشاركة، ثم «إضافة إلى الشاشة الرئيسية» <PlusSquare size={15} weight="bold" style={{ verticalAlign: '-2px' }} />، ثم افتحها من الأيقونة وفعّل الإشعارات.
          </p>
        )}
        <div className="acts">
          {status === 'off' && !needsIosInstall && (
            <button className="ab primary" onClick={enable} disabled={busy}>
              <BellRinging size={18} />
              {busy ? 'جارٍ التفعيل…' : 'تفعيل الإشعارات'}
            </button>
          )}
          {canInstall && (
            <button className="ab ghost" onClick={() => void installApp()}>
              <DownloadSimple size={18} />
              تثبيت التطبيق على الموبايل
            </button>
          )}
          {status === 'on' && (
            <>
              <button className="ab ghost" onClick={test} disabled={busy}>
                إرسال إشعار تجريبي
              </button>
              <button className="ab ghost" onClick={disable} disabled={busy}>
                إيقافها على هذا الجهاز
              </button>
            </>
          )}
          {!always && (
            <button className="ab ghost" onClick={dismiss}>
              ليس الآن
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
