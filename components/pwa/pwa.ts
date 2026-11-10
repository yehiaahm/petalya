'use client';

import { useSyncExternalStore } from 'react';

/**
 * Tiny store for "can this be installed as an app?".
 * The browser fires `beforeinstallprompt` once, early, so the listener is attached as soon as this module loads
 * (components mounting later still see the saved event).
 */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export type PwaState = { canPrompt: boolean; installed: boolean; ios: boolean; standalone: boolean };

let deferred: PromptEvent | null = null;
let installed = false;
let started = false;
let snap: PwaState = { canPrompt: false, installed: false, ios: false, standalone: false };
const listeners = new Set<() => void>();

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

function emit() {
  snap = { canPrompt: !!deferred, installed, ios: isIos(), standalone: isStandalone() };
  listeners.forEach((l) => l());
}

export function startPwa() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
  matchMedia('(display-mode: standalone)').addEventListener?.('change', emit);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  emit();
}
startPwa();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const SERVER: PwaState = { canPrompt: false, installed: false, ios: false, standalone: false };

export function usePwa() {
  const s = useSyncExternalStore(subscribe, () => snap, () => SERVER);
  /** Show an install button: the browser can prompt, or it is iOS (manual steps), and it is not installed yet. */
  const available = (s.canPrompt || s.ios) && !s.standalone && !s.installed;
  return { ...s, available };
}

/** Opens the browser's install dialog. Returns false when the browser has none (iOS: show the manual steps instead). */
export async function installApp() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  if (outcome === 'accepted') installed = true;
  emit();
  return outcome === 'accepted';
}
