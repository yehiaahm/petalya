'use client';

import Link from 'next/link';
import { scrollToId } from './Chrome';
import { ClockCountdown, FacebookLogo, InstagramLogo, Phone, ShoppingBagOpen, Storefront, TiktokLogo, Truck, WhatsappLogo } from '@phosphor-icons/react';
import { useSite } from './SiteProvider';
import content from '@/lib/content.json';

const ICONS = { ClockCountdown, Truck, Storefront } as const;

export function Contact() {
  const { ar, t, pick, wa, data, track, reduced } = useSite();
  const help = wa(pick('أهلاً Petalya! محتاج/ة مساعدة في طلب.', "Hi Petalya! I need a hand with an order."));
  return (
    <section id="contact" className="section" style={{ padding: 'clamp(80px,11vw,130px) 0 0' }}>
      <div className="wrap w1160">
        <div data-reveal="1" className="cta-block on-dark">
          <div className="eyebrow dark">
            <span>{pick('يلا نحتفل', "Let's celebrate")}</span>
          </div>
          <h2 className="h2 dark">
            {ar ? (
              <>
                جاهز <span className="accent">تحتفل؟</span>
              </>
            ) : (
              <>
                Ready to <em className="accent">celebrate?</em>
              </>
            )}
          </h2>
          <p className="lead-dark" style={{ marginInline: 'auto' }}>
            {pick('اطلب من الموقع في دقيقة — واختار التورتة أو صمّمها بنفسك. ولو محتاج مساعدة أو عندك فكرة خاصة، كلّمنا على واتساب.', "Order on the site in a minute — pick a cake or design your own. Need a hand or have a special idea? Message us on WhatsApp.")}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 30 }}>
            <a
              href="#menu"
              data-burst="1"
              className="btn btn-rose"
              style={{ boxShadow: '0 18px 34px -16px rgba(0,0,0,.6)' }}
              onClick={(e) => {
                e.preventDefault();
                scrollToId('menu', reduced);
              }}
            >
              <ShoppingBagOpen size={22} />
              {pick('اطلب من المنيو', 'Order from the menu')}
            </a>
            <a href={help} target="_blank" rel="noopener" className="btn btn-dark-outline" style={{ padding: '0 26px' }} onClick={() => track('whatsapp_click', { source: 'contact' })}>
              <WhatsappLogo size={21} />
              {pick('محتاج مساعدة؟ واتساب', 'Need help? WhatsApp')}
            </a>
            <a href={data.settings.instagramUrl} target="_blank" rel="noopener" className="btn btn-dark-outline" style={{ padding: '0 26px' }}>
              <InstagramLogo size={21} />
              <bdi dir="ltr">{data.settings.instagramHandle}</bdi>
            </a>
            {data.settings.tiktokUrl && (
              <a href={data.settings.tiktokUrl} target="_blank" rel="noopener" className="btn btn-dark-outline" style={{ padding: '0 26px' }}>
                <TiktokLogo size={21} />
                TikTok
              </a>
            )}
            {data.settings.facebookUrl && (
              <a href={data.settings.facebookUrl} target="_blank" rel="noopener" className="btn btn-dark-outline" style={{ padding: '0 26px' }}>
                <FacebookLogo size={21} />
                Facebook
              </a>
            )}
          </div>
        </div>
        <div className="info-grid">
          {content.info.map((f) => {
            const Ic = ICONS[f.icon as keyof typeof ICONS];
            return (
              <div key={f.icon} data-reveal="1" className="info-card">
                <span className="ic">
                  <Ic size={24} />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span className="t">{ar ? f.ar.title : f.en.title}</span>
                  <span className="d">{ar ? f.ar.desc : f.en.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Footer />
    </section>
  );
}

export function Footer() {
  const { pick, wa, data } = useSite();
  return (
    <footer className="site-footer">
      <div aria-hidden="true" data-shine="1" className="giant shine-text">
        Petalya
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--ink-muted)' }}>{pick('معمولة طازة وبكل حب · أمنية الجندي', 'Freshly made with love · by Omnia El Gendy')}</p>
      <div className="links">
        <a href={data.settings.instagramUrl} target="_blank" rel="noopener">
          <InstagramLogo size={17} />
          Instagram
        </a>
        <a href={wa(pick('أهلاً Petalya!', 'Hi Petalya!'))} target="_blank" rel="noopener">
          <WhatsappLogo size={17} />
          WhatsApp
        </a>
        {data.settings.tiktokUrl && (
          <a href={data.settings.tiktokUrl} target="_blank" rel="noopener">
            <TiktokLogo size={17} />
            TikTok
          </a>
        )}
        {data.settings.facebookUrl && (
          <a href={data.settings.facebookUrl} target="_blank" rel="noopener">
            <FacebookLogo size={17} />
            Facebook
          </a>
        )}
        <a href={'tel:+' + data.settings.whatsapp}>
          <Phone size={17} />
          {pick('اتصل بينا', 'Call us')}
        </a>
        <Link href="/track">{pick('تتبّع طلبك', 'Track your order')}</Link>
        <Link href="/links">{pick('روابطنا', 'Links')}</Link>
      </div>
      <p style={{ margin: '26px 0 0', fontSize: 12, color: 'var(--ink-faint)' }}>© {new Date().getFullYear()} Petalya Cakes</p>
    </footer>
  );
}
