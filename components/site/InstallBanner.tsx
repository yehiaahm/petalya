'use client';

import { useEffect, useState } from 'react';
import { DotsThreeVertical, DownloadSimple, Export, PlusSquare, X } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { installApp, usePwa } from '@/components/pwa/pwa';

/** "Don't show again" lives on the device for good; the × only hides the card for this visit. */
const NEVER_KEY = 'petalya.install.never';
const VISIT_KEY = 'petalya.install.closed';
export const INSTALL_EVENT = 'petalya:install';

function read(storage: 'local' | 'session', key: string) {
  try {
    return (storage === 'local' ? localStorage : sessionStorage).getItem(key) === '1';
  } catch {
    return false;
  }
}
function write(storage: 'local' | 'session', key: string) {
  try {
    (storage === 'local' ? localStorage : sessionStorage).setItem(key, '1');
  } catch {}
}

/** Opens the install flow from anywhere (e.g. the mobile menu). */
export const requestInstall = () => window.dispatchEvent(new Event(INSTALL_EVENT));

/** Side card shown as soon as a customer lands: install the site as an app. They can close it or turn it off for good. */
export function InstallBanner() {
  const { pick, count } = useSite();
  const pwa = usePwa();
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState(true);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    setClosed(read('local', NEVER_KEY) || read('session', VISIT_KEY));
    setReady(true);
  }, []);

  const start = async () => {
    if (pwa.canPrompt) await installApp();
    else setSteps(true);
  };

  useEffect(() => {
    const on = () => {
      setClosed(false);
      void start();
    };
    window.addEventListener(INSTALL_EVENT, on);
    return () => window.removeEventListener(INSTALL_EVENT, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwa.canPrompt]);

  const close = () => {
    setClosed(true);
    setSteps(false);
    write('session', VISIT_KEY);
  };
  const never = () => {
    setClosed(true);
    setSteps(false);
    write('local', NEVER_KEY);
  };

  if (!ready || closed || !pwa.showable) return null;

  return (
    <aside className={'install-bar' + (count > 0 ? ' above-cart' : '')} aria-label={pick('تثبيت التطبيق', 'Install the app')}>
      <button className="x" onClick={close} aria-label={pick('إغلاق', 'Close')}>
        <X size={16} />
      </button>
      <div className="head">
        <img src="/icons/icon-192.png" alt="" width={44} height={44} />
        <div className="txt">
          <b>{pick('ثبّت تطبيق Petalya', 'Install the Petalya app')}</b>
          <span>{pick('افتحه من شاشة موبايلك زي أي تطبيق.', 'Open it from your home screen like any app.')}</span>
        </div>
      </div>
      {steps ? (
        <ol className="steps">
          {pwa.ios ? (
            <>
              <li>
                {pick('اضغط زرار المشاركة', 'Tap the Share button')} <Export size={15} weight="bold" />
              </li>
              <li>
                {pick('اختار «إضافة إلى الشاشة الرئيسية»', 'Choose “Add to Home Screen”')} <PlusSquare size={15} weight="bold" />
              </li>
              <li>{pick('اضغط «إضافة»', 'Tap “Add”')}</li>
            </>
          ) : (
            <>
              <li>
                {pick('افتح قائمة المتصفح', 'Open the browser menu')} <DotsThreeVertical size={15} weight="bold" />
              </li>
              <li>{pick('اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»', 'Choose “Install app” or “Add to Home screen”')}</li>
            </>
          )}
        </ol>
      ) : (
        <button className="go" onClick={start}>
          <DownloadSimple size={18} weight="bold" />
          {pick('تثبيت', 'Install')}
        </button>
      )}
      <button className="never" onClick={never}>
        {pick('متظهرليش تاني', "Don't show this again")}
      </button>
    </aside>
  );
}

/** Small text button for menus; renders nothing when the app is already installed or cannot be installed. */
export function InstallLink({ onClick, tabIndex }: { onClick?: () => void; tabIndex?: number }) {
  const { pick } = useSite();
  const { showable } = usePwa();
  if (!showable) return null;
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
