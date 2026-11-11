'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, Confetti, Flower, PenNib, ShoppingBagOpen, Sparkle, WhatsappLogo, CheckCircle } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { FwdIcon } from './Chrome';
import { designPrice, designSummary, isoDay } from '@/lib/pricing';
import type { CustomDesign } from '@/lib/types';
import { prefersReduced } from '@/lib/petals';
import { arCount } from '@/lib/ar';

const FLAKES = [
  [[10, 26, 7, 20], [24, 64, 5, 45], [38, 20, 6, 10], [55, 58, 8, 70], [70, 28, 5, 15], [84, 62, 7, 40], [46, 80, 4, 60], [90, 34, 5, 25]],
  [[14, 34, 6, 30], [30, 70, 5, 55], [52, 26, 7, 15], [68, 66, 5, 75], [84, 36, 6, 35]],
  [[18, 40, 6, 25], [44, 70, 5, 60], [64, 30, 6, 10], [82, 62, 5, 45]],
];
const DIMS = [[[220, 104]], [[244, 88], [172, 76]], [[252, 78], [192, 68], [134, 60]]];
const FC = [['#FFF4EE', '#EBA99C', '#D98C80'], ['#FFFFFF', '#F6E6D8', '#E3CBB5'], ['#FCE3DC', '#F2C1B6', '#E5A193']];
const ICONS: Record<string, React.ComponentType<{ size?: number }>> = { Flower, Camera, Sparkle, PenNib };

function usePopIn(deps: unknown[]) {
  const root = useRef<HTMLDivElement>(null);
  const seen = useRef(new WeakSet<Element>());
  const first = useRef(true);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const silent = first.current || prefersReduced();
    first.current = false;
    el.querySelectorAll<HTMLElement>('[data-pop]').forEach((n) => {
      if (seen.current.has(n)) return;
      seen.current.add(n);
      if (silent) return;
      const kind = n.dataset.pop;
      if (kind === 'drop') n.animate([{ translate: '0 -170px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 760, easing: 'cubic-bezier(.3,1.45,.5,1)' });
      else if (kind === 'step') n.animate([{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      else n.animate([{ scale: '0', opacity: 0 }, { scale: '1', opacity: 1 }], { duration: 560, delay: Math.random() * 200, easing: 'cubic-bezier(.3,1.7,.5,1)', fill: 'backwards' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return root;
}

export function CakeBuilder({ photos }: { photos: string[] }) {
  const { ar, t, pick, fmt, data, burst, addCustom, wa, toast, track, showPrices } = useSite();
  const cfg = data.settings.builder;
  const [step, setStep] = useState(0);
  const [occ, setOcc] = useState(0);
  const [size, setSize] = useState(Math.min(1, cfg.sizes.length - 1));
  const [flavour, setFlavour] = useState(0);
  const [colour, setColour] = useState(0);
  const [decos, setDecos] = useState<Record<string, boolean>>({ flowers: true, gold: true });
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [added, setAdded] = useState(false);
  const [shownPrice, setShownPrice] = useState(0);
  const priceRaf = useRef(0);

  const design: CustomDesign = useMemo(
    () => ({
      occasionId: cfg.occasions[occ]?.id,
      sizeId: cfg.sizes[size]?.id,
      flavourId: cfg.flavours[flavour]?.id,
      colourId: cfg.colours[colour]?.id,
      decorations: cfg.decorations.filter((d) => decos[d.id]).map((d) => d.id),
      message: message.trim(),
      date,
    }),
    [cfg, occ, size, flavour, colour, decos, message, date],
  );
  const price = designPrice(cfg, design);

  useEffect(() => setAdded(false), [design]);

  useEffect(() => {
    cancelAnimationFrame(priceRaf.current);
    const from = shownPrice || price, t0 = performance.now();
    const f = (now: number) => {
      const q = Math.min(1, (now - t0) / 650), e = 1 - Math.pow(1 - q, 3);
      setShownPrice(Math.round((from + (price - from) * e) / 10) * 10);
      if (q < 1) priceRaf.current = requestAnimationFrame(f);
    };
    priceRaf.current = requestAnimationFrame(f);
    return () => cancelAnimationFrame(priceRaf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price]);

  const stageRef = usePopIn([size, decos, message, ar]);
  const panelRef = usePopIn([step]);

  if (!cfg.enabled || !cfg.sizes.length) return null;

  const sz = cfg.sizes[size], col = cfg.colours[colour], oc = cfg.occasions[occ];
  const dims = DIMS[Math.min(3, Math.max(1, sz.tiers)) - 1];
  let b = 84;
  const tiers = dims.map((d, i) => {
    const tt = { w: d[0], h: d[1], b, i };
    b += d[1] - 6;
    return tt;
  });
  const topB = b, topW = dims[dims.length - 1][0];
  const flowers: { x: number; y: number; s: number; bg: string }[] = [];
  const addF = (x: number, y: number, s: number, c: number) => {
    const p = FC[c % 3];
    flowers.push({ x, y, s, bg: `radial-gradient(circle, ${p[2]} 0 14%, ${p[0]} 16% 30%, ${p[1]} 32% 52%, ${p[0]} 54% 62%, ${p[1]} 64% 100%)` });
  };
  if (decos.flowers) {
    addF(-topW / 2 + 22, topB - 2, 34, 0);
    addF(-topW / 2 + 50, topB + 6, 24, 1);
    addF(-topW / 2 + 6, topB + 14, 20, 2);
    addF(topW / 2 - 18, topB + 2, 22, 2);
    tiers.slice(0, -1).forEach((tt, i) => {
      addF(tt.w / 2 - 16, tt.b + tt.h - 8, 28, i);
      addF(tt.w / 2 - 40, tt.b + tt.h - 2, 18, i + 1);
    });
  }
  const picks = decos.photos ? [[-38, 36, -13], [0, 50, 2], [36, 40, 12]].map((p, i) => ({ x: p[0], h: p[1], r: p[2], img: photos[i % Math.max(1, photos.length)] })) : [];
  const msgColor = col.messageColour || '#7E4A30';
  const STEP_T = ar ? ['المناسبة إيه؟', 'محتاج حجم قد إيه؟', 'النكهة واللون', 'الديكور', 'اللمسة الأخيرة'] : ['What’s the occasion?', 'How big should it be?', 'Flavour & colour', 'How shall we dress it?', 'Final touches'];
  const summary = designSummary(cfg, design);
  const minDate = isoDay(data.settings.leadDays);
  const dateBad = !!date && date < minDate;
  const buildMsg =
    pick('أهلاً Petalya! صمّمت الـ Cake بتاعي على الموقع:\n', 'Hi Petalya! I designed my cake on your site:\n') +
    summary.map((r) => '• ' + t(r.k) + ': ' + t(r.v)).join('\n') +
    (showPrices ? '\n' + pick('السعر التقريبي يبدأ من ', 'Estimated from ') + fmt(price) : '');

  const addToOrder = (e: React.MouseEvent) => {
    if (dateBad) return;
    addCustom(design);
    setAdded(true);
    burst(e.clientX, e.clientY, 22);
    toast(pick('الـ Cake اتضاف لطلبك', 'Your cake was added to the order'));
    track('builder_complete', { price });
  };

  return (
    <section id="custom" className="section">
      <div className="wrap w1160">
        <div className="center">
          <div data-reveal="1" className="eyebrow">
            <span>{pick('على ذوقك', 'Made to order')}</span>
          </div>
          <h2 data-reveal="1" className="h2">
            {ar ? (
              <>
                صمّم <span className="accent">الـ Cake بتاعك</span>
              </>
            ) : (
              <>
                Design <em className="accent">your</em> cake
              </>
            )}
          </h2>
          <p data-reveal="1" className="intro">
            {pick('اختار المناسبة والحجم والنكهة والديكور، وشوف الـ Cake بيتبني قدامك — وبعدين ضيفه لطلبك بضغطة.', 'Pick the occasion, size, flavour and décor — watch your cake come together, then add it to your order in one tap.')}
          </p>
        </div>
        <div className="builder">
          <div data-reveal="1" ref={stageRef} className="stage" onPointerDown={(e) => burst(e.clientX, e.clientY, 14)} aria-label={pick('معاينة الـ Cake', 'Cake preview')}>
            <div className="chips">
              <span className="chip">
                <Confetti size={16} color="#B97E5E" />
                {t(oc.name)}
              </span>
              {showPrices && <span className="chip dark">{pick('من ', 'From ') + fmt(shownPrice || price)}</span>}
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 130, background: 'linear-gradient(180deg, rgba(241,210,198,0), rgba(232,190,172,.5))' }} />
            <div className="abs" style={{ bottom: 30, width: 230, height: 18, marginLeft: -115, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(74,44,34,.28), rgba(74,44,34,0))' }} />
            <div className="abs" style={{ bottom: 36, width: 128, height: 14, marginLeft: -64, borderRadius: '50%', background: 'linear-gradient(180deg,#E7BE9E,#9A6244)' }} />
            <div className="abs" style={{ bottom: 43, width: 22, height: 38, marginLeft: -11, background: 'linear-gradient(90deg,#8C5638,#E2B08C 45%,#9A6244)' }} />
            <div className="abs" style={{ bottom: 74, width: 292, height: 20, marginLeft: -146, borderRadius: '50%', background: 'linear-gradient(180deg,#F0CFB4,#B97E5E 60%,#8C5638)', boxShadow: '0 8px 14px -8px rgba(74,44,34,.5)', zIndex: 5 }} />
            {tiers.map((tt) => (
              <div
                key={tt.i}
                data-pop="drop"
                className="tier"
                style={{ bottom: tt.b, width: tt.w, height: tt.h, marginLeft: -tt.w / 2, zIndex: 10 + tt.i, background: `linear-gradient(180deg, ${col.light} 0%, ${col.base} 38%, ${col.dark} 100%)` }}
              >
                <div className="top" style={{ background: col.light }} />
                <div className="pearls" />
                {decos.gold && FLAKES[tt.i].map((f, j) => <span key={j} data-pop="pop" className="flake" style={{ left: f[0] + '%', top: f[1] + '%', width: f[2], height: f[2], transform: `rotate(${f[3]}deg)` }} />)}
                {tt.i === 0 && message.trim() && (
                  <span className="msg" style={{ color: msgColor }}>
                    {message}
                  </span>
                )}
              </div>
            ))}
            {flowers.map((f, i) => (
              <span key={'f' + i} data-pop="pop" className="cake-flower" style={{ left: `calc(50% + ${f.x}px)`, bottom: f.y, width: f.s, height: f.s, marginLeft: -f.s / 2, marginBottom: -f.s / 2, background: f.bg }} />
            ))}
            {picks.map((p, i) => (
              <div key={'p' + i} data-pop="pop" className="cake-pick" style={{ left: `calc(50% + ${p.x}px)`, bottom: topB + 4, transform: `rotate(${p.r}deg)` }}>
                <span className="stick" style={{ height: p.h }} />
                <span className="frame" style={{ bottom: p.h }}>
                  <span style={{ backgroundImage: p.img ? `url(${p.img})` : undefined }} />
                </span>
              </div>
            ))}
            {decos.topper && (
              <div data-pop="pop" className="topper" style={{ bottom: topB + (decos.photos ? 72 : 16) }}>
                <span className="txt">{t(oc.topper)}</span>
                <span className="sticks">
                  <span />
                  <span />
                </span>
              </div>
            )}
            <div className="hint">{pick('اضغط على الـ Cake واحتفل', 'Tap the cake to celebrate')}</div>
          </div>

          <div data-reveal="1" ref={panelRef} className="panel">
            <div className="progress">
              {STEP_T.map((label, i) => (
                <button key={i} className={i <= step ? 'on' : ''} onClick={() => setStep(i)} aria-label={label} aria-current={i === step ? 'step' : undefined}>
                  <span />
                </button>
              ))}
            </div>
            <span className="step-count">{ar ? `خطوة ${step + 1} من 5` : `Step ${step + 1} of 5`}</span>
            <h3 className="step-title">{STEP_T[step]}</h3>

            {step === 0 && (
              <div key="s0" data-pop="step" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {cfg.occasions.map((o, i) => (
                  <button key={o.id} data-burst="1" className={'chip-opt' + (occ === i ? ' on' : '')} onClick={() => setOcc(i)} aria-pressed={occ === i}>
                    {occ === i && <Check size={14} weight="bold" />}
                    {t(o.name)}
                  </button>
                ))}
              </div>
            )}
            {step === 1 && (
              <div key="s1" data-pop="step" style={{ display: 'grid', gridTemplateColumns: `repeat(${cfg.sizes.length},minmax(0,1fr))`, gap: 10 }}>
                {cfg.sizes.map((z, i) => (
                  <button key={z.id} data-burst="1" className={'size-opt' + (size === i ? ' on' : '')} onClick={() => setSize(i)} aria-pressed={size === i}>
                    <span className="bars">
                      {[40, 30, 20].slice(0, z.tiers).map((w) => (
                        <span key={w} style={{ width: w }} />
                      ))}
                    </span>
                    <span className="l">{t(z.name)}</span>
                    <span className="s">{t(z.serves)}</span>
                  </button>
                ))}
              </div>
            )}
            {step === 2 && (
              <div key="s2" data-pop="step" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span className="field-label">{pick('النكهة', 'Flavour')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {cfg.flavours.map((f, i) => (
                      <button key={f.id} className={'chip-opt sm' + (flavour === i ? ' on' : '')} onClick={() => setFlavour(i)} aria-pressed={flavour === i}>
                        {flavour === i && <Check size={13} weight="bold" />}
                        {t(f.name) + (f.surcharge ? ' +' + f.surcharge : '')}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span className="field-label">{pick('لون الكريمة', 'Frosting colour')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                    {cfg.colours.map((c, i) => (
                      <button key={c.id} data-burst="1" className={'swatch' + (colour === i ? ' on' : '')} onClick={() => setColour(i)} aria-pressed={colour === i} aria-label={t(c.name)}>
                        <i style={{ background: c.base }} />
                        {t(c.name)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {step === 3 && (
              <div key="s3" data-pop="step" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
                {cfg.decorations.map((d) => {
                  const on = !!decos[d.id];
                  const Ic = ICONS[d.icon] || Sparkle;
                  return (
                    <button key={d.id} data-burst="1" className={'deco-opt' + (on ? ' on' : '')} onClick={() => setDecos((s) => ({ ...s, [d.id]: !s[d.id] }))} aria-pressed={on}>
                      <span className="row">
                        <Ic size={24} />
                        <span className="ck">{on && <Check size={12} weight="bold" />}</span>
                      </span>
                      <span className="l">{t(d.name)}</span>
                      {showPrices && <span className="a">+{fmt(d.perTier ? d.price * sz.tiers : d.price)}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {step === 4 && (
              <div key="s4" data-pop="step" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="field">
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {pick('الكتابة على الـ Cake', 'Message on the cake')}
                    <span className="num" style={{ fontWeight: 500, color: 'var(--ink-faint)' }}>{message.length}/22</span>
                  </span>
                  <input className="input" value={message} maxLength={22} onChange={(e) => setMessage(e.target.value.slice(0, 22))} placeholder={pick('اسم أو رسالة قصيرة', 'A name or a short message')} />
                </label>
                <label className="field">
                  <span>{pick('تاريخ المناسبة', 'Celebration date')}</span>
                  <input type="date" className={'input' + (dateBad ? ' err' : '')} value={date} min={minDate} onChange={(e) => setDate(e.target.value)} />
                  {dateBad && <span className="err-text">{pick(`محتاجين ${arCount(data.settings.leadDays, 'day')} على الأقل عشان نجهّزه.`, `We need at least ${data.settings.leadDays} days to make it.`)}</span>}
                </label>
                <div className="summary-box">
                  {summary.map((r) => (
                    <div key={r.k.en} className="r">
                      <span>{t(r.k)}</span>
                      <span>{t(r.v)}</span>
                    </div>
                  ))}
                  {showPrices && (
                    <div className="r" style={{ borderTop: '1px dashed rgba(185,126,94,.4)', paddingTop: 9, marginTop: 3 }}>
                      <span>{pick('السعر التقريبي', 'Estimated price')}</span>
                      <span className="num">{fmt(price)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6, flexWrap: 'wrap' }}>
              {step > 0 && (
                <button className="btn btn-ghost btn-md" style={{ padding: '0 18px' }} onClick={() => setStep(step - 1)}>
                  {pick('رجوع', 'Back')}
                </button>
              )}
              <div className="spacer" />
              {step < 4 ? (
                <button className="btn btn-flat btn-md" data-burst="1" onClick={() => setStep(step + 1)}>
                  {pick('التالي', 'Next')}
                  <FwdIcon size={17} />
                </button>
              ) : added ? (
                <Link href="/checkout" className="btn btn-flat btn-md" data-burst="1">
                  <CheckCircle size={20} weight="fill" color="#F2C6BD" />
                  {pick('كمّل الطلب', 'Go to checkout')}
                  <FwdIcon size={17} />
                </Link>
              ) : (
                <button className="btn btn-rose btn-md" data-burst="1" onClick={addToOrder} disabled={dateBad} style={{ padding: '0 22px' }}>
                  <ShoppingBagOpen size={20} />
                  {pick('ضيفه لطلبي', 'Add to my order')}
                </button>
              )}
            </div>
            {step === 4 && (
              <a href={wa(buildMsg)} target="_blank" rel="noopener" onClick={() => track('whatsapp_click', { source: 'builder' })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, alignSelf: 'flex-end' }}>
                <WhatsappLogo size={17} />
                {pick('محتاج تتكلم معانا الأول؟ ابعت التصميم على واتساب', 'Want to talk it through first? Send the design on WhatsApp')}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
