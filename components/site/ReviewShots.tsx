'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowsOutSimple, ChatsCircle, X } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { BackIcon, FwdIcon } from './Chrome';

/** Phone-shaped screenshots of real customer chats: they drift past on their own, and a tap opens them full size. */
export function ReviewShots({ shots }: { shots: string[] }) {
  const { ar, pick } = useSite();
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const show = (i: number, el: HTMLElement) => {
    opener.current = el;
    setOpen(i);
  };
  const close = useCallback(() => {
    setOpen(null);
    opener.current?.focus({ preventScroll: true });
  }, []);

  if (!shots.length) return null;

  // Enough copies that one half of the track is always wider than the screen, so the loop never shows a gap.
  const sets = 4;
  const dur = Math.max(30, shots.length * 10);

  return (
    <section id="chats" className="section shots">
      <div className="wrap w1080 center">
        <div data-reveal="1" className="eyebrow">
          <span>{pick('من الشات مباشرة', 'Straight from the chat')}</span>
        </div>
        <h2 data-reveal="1" className="h2">
          {ar ? (
            <>
              كلامهم <span className="accent">بعد التورتة</span>
            </>
          ) : (
            <>
              What they sent <em className="accent">after the cake</em>
            </>
          )}
        </h2>
        <p data-reveal="1" className="intro">
          {pick('رسايل حقيقية من عملاءنا. اضغط على أي واحدة تشوفها كاملة.', 'Real messages from our customers. Tap any one to read it in full.')}
        </p>
      </div>

      <div className="shots-viewport" data-reveal="1">
        <div className="shots-track" style={{ ['--dur' as string]: `${dur}s` }}>
          {Array.from({ length: sets }, (_, s) =>
            shots.map((src, i) => (
              <button
                key={`${s}-${i}`}
                type="button"
                className="shot"
                tabIndex={s === 0 ? 0 : -1}
                aria-hidden={s === 0 ? undefined : true}
                aria-label={pick(`افتح رأي العميل رقم ${i + 1}`, `Open customer message ${i + 1}`)}
                onClick={(e) => show(i, e.currentTarget)}
              >
                <img src={src} alt={s === 0 ? pick(`رسالة من عميلة رقم ${i + 1}`, `Customer message ${i + 1}`) : ''} loading="lazy" draggable={false} />
                <span className="zoom" aria-hidden="true">
                  <ArrowsOutSimple size={17} weight="bold" />
                </span>
              </button>
            )),
          )}
        </div>
      </div>

      <p className="shots-hint">
        <ChatsCircle size={18} />
        {pick('الصور بتقف لما تقف عليها', 'Hover to pause')}
      </p>

      {open !== null && <Viewer shots={shots} index={open} setIndex={setOpen} onClose={close} />}
    </section>
  );
}

function Viewer({ shots, index, setIndex, onClose }: { shots: string[]; index: number; setIndex: (i: number) => void; onClose: () => void }) {
  const { ar, pick } = useSite();
  const n = shots.length;
  const dirRef = useRef(1);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const go = useCallback(
    (d: number) => {
      if (n < 2) return;
      dirRef.current = d;
      setIndex((index + d + n) % n);
    },
    [index, n, setIndex],
  );
  // "next" follows reading direction: right in English, left in Arabic.
  const next = () => go(1);
  const prev = () => go(-1);

  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true });
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(ar ? -1 : 1);
      else if (e.key === 'ArrowLeft') go(ar ? 1 : -1);
      else if (e.key === 'Tab') {
        // keep focus inside the dialog
        const els = Array.from(document.querySelectorAll<HTMLElement>('.viewer button'));
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [ar, go, onClose]);

  // warm the neighbours so arrows feel instant
  useEffect(() => {
    [(index + 1) % n, (index - 1 + n) % n].forEach((i) => {
      const im = new Image();
      im.src = shots[i];
    });
  }, [index, n, shots]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={pick('آراء العملاء', 'Customer messages')} onClick={onClose}>
      <button ref={closeBtn} type="button" className="v-close" onClick={onClose} aria-label={pick('إغلاق', 'Close')}>
        <X size={20} weight="bold" />
      </button>
      <div
        className="v-stage"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => (drag.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s = drag.current;
          drag.current = null;
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) go((dx < 0 ? 1 : -1) * (ar ? -1 : 1));
        }}
        onPointerCancel={() => (drag.current = null)}
      >
        <button type="button" className="v-nav" onClick={prev} aria-label={pick('السابق', 'Previous')} disabled={n < 2}>
          <BackIcon size={22} />
        </button>
        <div className="v-frame">
          <img key={index} className={dirRef.current > 0 ? 'in-next' : 'in-prev'} data-ar={ar ? '1' : undefined} src={shots[index]} alt={pick(`رسالة عميل ${index + 1} من ${n}`, `Customer message ${index + 1} of ${n}`)} draggable={false} />
        </div>
        <button type="button" className="v-nav" onClick={next} aria-label={pick('التالي', 'Next')} disabled={n < 2}>
          <FwdIcon size={22} />
        </button>
      </div>
      <div className="v-count" onClick={(e) => e.stopPropagation()} aria-live="polite">
        <span className="num" dir="ltr">
          {index + 1} / {n}
        </span>
      </div>
    </div>
  );
}
