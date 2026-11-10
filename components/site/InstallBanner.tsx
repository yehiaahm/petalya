'use client';

import { useEffect, useState } from 'react';
import { DownloadSimple, Export, PlusSquare, X } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { installApp, usePwa } from '@/components/pwa/pwa';

const HIDE_KEY = 'petalya.install.hide';
const HIDE_DAYS = 7;
export const INSTALL_EVENT = 'petalya:install';

function recentlyHidden() {
  try {
    const t = Number(localStorage.getItem(HIDE_KEY));
    return !!t && Date.now() - t < HIDE_DAYS * 864e5;
  } catch {
    return false;
  }
}

/** Opens the install flow from anywhere (e.g. the mobile menu). */
export const requestInstall = () => window.dispatchEvent(new Event(INSTALL_EVENT));

/** "Install the app" card shown to customers a few seconds after they land, plus the iOS how-to. */
export function InstallBanner() {
  const { pick, count } = useSite();
  const pwa = usePwa();
  const [delayed, setDelayed] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    setHidden(recentlyHidden());
    const id = setTimeout(() => setDelayed(true), 4500);
    return () => clearTimeout(id);
  }, []);

  const start = async () => {
    if (pwa.canPrompt) await installApp();
    else setSteps(true);
  };

  useEffect(() => {
    const on = () => void start();
    window.addEventListener(INSTALL_EVENT, on);
    return () => window.removeEventListener(INSTALL_EVENT, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwa.canPrompt]);

  const close = () => {
    setHidden(true);
    setSteps(false);
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now()));
    } catch {}
  };

  if (!pwa.available) return null;
  const show = steps || (delayed && !hidden && count === 0);
  if (!show) return null;

  return (
    <div className="install-bar" role="dialog" aria-label={pick('تثبيت التطبيق', 'Install the app')}>
      <img src="/icons/icon-192.png" alt="" width={48} height={48} />
      <div className="txt">
        {steps ? (
          <ol>
            <li>
              {pick('اضغط زرار المشاركة', 'Tap the Share button')} <Export size={16} weight="bold" />
            </li>
            <li>
              {pick('اختار «إضافة إلى الشاشة الرئيسية»', 'Choose “Add to Home Screen”')} <PlusSquare size={16} weight="bold" />
            </li>
            <li>{pick('اضغط «إضافة» وافتح Petalya من الشاشة', 'Tap “Add”, then open Petalya from your home screen')}</li>
          </ol>
        ) : (
          <>
            <b>{pick('ثبّت تطبيق Petalya', 'Install the Petalya app')}</b>
            <span>{pick('اطلب أسرع وافتحه من شاشة الموبايل زي أي تطبيق.', 'Order faster, right from your home screen.')}</span>
          </>
        )}
      </div>
      {!steps && (
        <button className="go" onClick={start}>
          <DownloadSimple size={18} weight="bold" />
          {pick('تثبيت', 'Install')}
        </button>
      )}
      <button className="x" onClick={close} aria-label={pick('إغلاق', 'Close')}>
        <X size={17} />
      </button>
    </div>
  );
}

/** Small text button for menus; renders nothing when the app is already installed or cannot be installed. */
export function InstallLink({ onClick, tabIndex }: { onClick?: () => void; tabIndex?: number }) {
  const { pick } = useSite();
  const { available } = usePwa();
  if (!available) return null;
  return (
    <button
      type="button"
      tabIndex={tabIndex}
      onClick={() => {
        onClick?.();
        requestInstall();
      }}
      style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <DownloadSimple size={16} />
      {pick('ثبّت التطبيق', 'Install the app')}
    </button>
  );
}
