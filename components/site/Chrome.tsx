'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { List, ShoppingBagOpen, Trash, WhatsappLogo, X, ArrowLeft, ArrowRight, UserCircle } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import { InstallLink } from './InstallBanner';
import content from '@/lib/content.json';

export const NAV = content.nav;

export function scrollToId(id: string, reduced = false) {
  const el = document.getElementById(id);
  if (!el) return false;
  const y = id === 'top' ? 0 : el.getBoundingClientRect().top + scrollY - 40;
  scrollTo({ top: Math.max(0, y), behavior: reduced ? 'auto' : 'smooth' });
  return true;
}

export function FwdIcon({ size = 18 }: { size?: number }) {
  const { ar } = useSite();
  return ar ? <ArrowLeft size={size} /> : <ArrowRight size={size} />;
}
export function BackIcon({ size = 18 }: { size?: number }) {
  const { ar } = useSite();
  return ar ? <ArrowRight size={size} /> : <ArrowLeft size={size} />;
}

export function LangToggle() {
  const { lang, toggleLang } = useSite();
  return (
    <button onClick={toggleLang} data-burst="1" aria-label="Switch language" className={'lang-toggle' + (lang === 'en' ? ' is-en' : '')}>
      <span className="thumb" />
      <span className={'lbl ar' + (lang === 'ar' ? ' on' : '')}>ع</span>
      <span className={'lbl en' + (lang === 'en' ? ' on' : '')}>EN</span>
    </button>
  );
}

export function Header({ home = false }: { home?: boolean }) {
  const { t, pick, wa, count, track, reduced, user } = useSite();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(scrollY > 24);
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [open]);

  const go = (e: React.MouseEvent, id: string) => {
    setOpen(false);
    if (!home) return; // let the link navigate to /#id
    e.preventDefault();
    scrollToId(id, reduced);
    history.replaceState(null, '', id === 'top' ? '/' : '#' + id);
  };
  const help = wa(pick('أهلاً Petalya! محتاج/ة مساعدة في طلب.', "Hi Petalya! I need a hand with an order."));

  return (
    <>
      <header className={'site-header' + (scrolled ? ' scrolled' : '')}>
        <div className="row">
          <Link href="/" onClick={(e) => go(e, 'top')} aria-label="Petalya" className="brand">
            <img src="/assets/logo.png" alt="" />
            <span className="wordmark">Petalya</span>
          </Link>
          <div className="spacer" />
          <nav aria-label="Main">
            {NAV.slice(0, 5).map((n) => (
              <Link key={n.id} href={'/#' + n.id} onClick={(e) => go(e, n.id)}>
                {t(n)}
              </Link>
            ))}
          </nav>
          <div className="spacer" />
          <LangToggle />
          <AccountButton />
          {count > 0 && (
            <Link href="/checkout" className="icon-btn bag-btn" aria-label={pick('طلبك', 'Your order')}>
              <ShoppingBagOpen size={21} />
              <span className="badge">{count}</span>
            </Link>
          )}
          <Link href="/#menu" data-burst="1" className="order-now" onClick={(e) => go(e, 'menu')}>
            <ShoppingBagOpen size={19} />
            {pick('اطلب دلوقتي', 'Order now')}
          </Link>
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Menu" aria-expanded={open}>
            <List size={22} />
          </button>
        </div>
      </header>

      <div className={'mobile-menu' + (open ? ' open' : '')} aria-hidden={!open} role="dialog" aria-modal="true">
        <div className="top">
          <span className="wordmark">Petalya</span>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close" tabIndex={open ? 0 : -1}>
            <X size={20} />
          </button>
        </div>
        <nav>
          {NAV.map((n, i) => (
            <Link key={n.id} href={'/#' + n.id} onClick={(e) => go(e, n.id)} tabIndex={open ? 0 : -1} style={{ transitionDelay: open ? `${0.2 + i * 0.06}s` : '0s' }}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <span className="t">{t(n)}</span>
            </Link>
          ))}
        </nav>
        <div className="bottom">
          {count > 0 && (
            <Link href="/checkout" className="btn btn-flat" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
              <ShoppingBagOpen size={21} />
              {pick(`أكمل طلبك (${count})`, `Complete your order (${count})`)}
            </Link>
          )}
          <Link href="/#menu" data-burst="1" className="btn btn-rose" tabIndex={open ? 0 : -1} onClick={(e) => go(e, 'menu')}>
            <ShoppingBagOpen size={22} />
            {pick('اطلب من المنيو', 'Order from the menu')}
          </Link>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22, fontSize: 14 }}>
            <Link href={user ? '/account' : '/account/login'} tabIndex={open ? 0 : -1}>
              {user ? pick('حسابي', 'My account') : pick('تسجيل الدخول', 'Sign in')}
            </Link>
            <Link href="/track" tabIndex={open ? 0 : -1}>
              {pick('تتبّع طلبك', 'Track your order')}
            </Link>
            <a href={help} target="_blank" rel="noopener" tabIndex={open ? 0 : -1} onClick={() => track('whatsapp_click', { source: 'menu' })}>
              {pick('مساعدة على واتساب', 'Help on WhatsApp')}
            </a>
            <InstallLink tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </>
  );
}

export function AccountButton() {
  const { user, pick } = useSite();
  return (
    <Link href={user ? '/account' : '/account/login'} className="icon-btn acct-btn" aria-label={user ? pick('حسابي', 'My account') : pick('تسجيل الدخول', 'Sign in')} title={user ? user.name : pick('تسجيل الدخول', 'Sign in')}>
      {user ? user.avatar ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="ini">{user.name.charAt(0)}</span> : <UserCircle size={23} />}
    </Link>
  );
}

export function Fab() {
  const { wa, pick, count, track } = useSite();
  return (
    <a
      href={wa(pick('أهلاً Petalya! محتاج/ة مساعدة في طلب.', "Hi Petalya! I need a hand with an order."))}
      target="_blank"
      rel="noopener"
      aria-label={pick('محتاج مساعدة؟ كلّمنا على واتساب', 'Need help? Chat on WhatsApp')}
      data-burst="1"
      className={'fab' + (count ? ' hide' : '')}
      onClick={() => track('whatsapp_click', { source: 'fab' })}
    >
      <span className="ring" />
      <WhatsappLogo size={28} />
    </a>
  );
}

export function CartBar() {
  const { count, subtotal, fmt, pick, clear, toast, showPrices } = useSite();
  return (
    <div className={'cart-bar' + (count ? ' show' : '')} aria-hidden={!count}>
      <span className="bag">
        <ShoppingBagOpen size={22} />
        <b>{count}</b>
      </span>
      <div className="lbl">
        <span>{pick('طلبك', 'Your order')}</span>
        {showPrices && <span>{fmt(subtotal)}</span>}
      </div>
      <button
        className="clear"
        aria-label={pick('امسح الطلب', 'Clear')}
        tabIndex={count ? 0 : -1}
        onClick={() => {
          clear();
          toast(pick('اتمسح الطلب', 'Order cleared'));
        }}
      >
        <Trash size={19} />
      </button>
      <Link href="/checkout" data-burst="1" className="send" tabIndex={count ? 0 : -1}>
        {pick('أكمل الطلب', 'Checkout')}
        <FwdIcon size={17} />
      </Link>
    </div>
  );
}
