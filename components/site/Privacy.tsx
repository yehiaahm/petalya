'use client';

import { useSite } from './SiteProvider';
import { MiniHeader } from './Checkout';

type Section = { title: [string, string]; body: [string, string][] };

const SECTIONS: Section[] = [
  {
    title: ['البيانات التي نجمعها', 'What we collect'],
    body: [
      ['عند الطلب: اسمك، ورقم موبايلك، وعنوان التوصيل، وتفاصيل الطلب.', 'When you order: your name, mobile number, delivery address and the order details.'],
      ['عند إنشاء حساب: اسمك وبريدك الإلكتروني، وكلمة مرور محفوظة بصيغة مشفّرة (لا يمكننا الاطلاع عليها).', 'When you create an account: your name and email, and a password stored only as a secure hash (we can’t read it).'],
      ['عند تسجيل الدخول باستخدام Google: يشاركنا Google اسمك وبريدك الإلكتروني وصورة حسابك فقط، ولا نصل إلى أي بيانات أخرى في حسابك.', 'When you sign in with Google: Google shares only your name, email address and profile picture. We get no other access to your Google account.'],
      ['إحصائيات زيارات بسيطة (الصفحات التي فُتحت)، بدون إعلانات أو أدوات تتبّع من جهات أخرى.', 'Simple visit statistics (which pages were opened), with no ads and no third-party trackers.'],
    ],
  },
  {
    title: ['كيف نستخدمها', 'How we use it'],
    body: [
      ['لتحضير طلبك وتوصيله والتواصل معك بشأنه (غالبًا على واتساب).', 'To prepare and deliver your order and contact you about it (usually on WhatsApp).'],
      ['لملء بياناتك تلقائيًا في طلباتك القادمة، وعرض طلباتك السابقة.', 'To fill in your details automatically next time and show you your past orders.'],
      ['لا نبيع بياناتك ولا نشاركها مع أي جهة، إلا ما يلزم لتوصيل طلبك.', 'We never sell or share your data with anyone, except what delivery requires.'],
    ],
  },
  {
    title: ['حقوقك', 'Your choices'],
    body: [
      ['يمكنك تعديل بياناتك من صفحة حسابك في أي وقت.', 'You can edit your details from your account page at any time.'],
      ['إذا أردت حذف حسابك وبياناتك، راسلنا على واتساب وسنحذفها.', 'To have your account and data deleted, message us on WhatsApp and we’ll remove it.'],
      ['يمكنك إلغاء صلاحية وصول Petalya إلى حسابك على Google من myaccount.google.com/permissions.', 'You can remove Petalya’s access from your Google account at myaccount.google.com/permissions.'],
    ],
  },
];

export function Privacy() {
  const { pick, ar, wa } = useSite();
  return (
    <div className="page-bg">
      <MiniHeader />
      <main className="wrap" style={{ maxWidth: 720, padding: 'clamp(40px,8vw,80px) 20px' }}>
        <div className="center">
          <div className="eyebrow"><span>Petalya</span></div>
          <h1 className="h2" style={{ fontSize: ar ? 'clamp(32px,7vw,48px)' : 'clamp(40px,8vw,60px)' }}>
            {pick('سياسة الخصوصية', 'Privacy policy')}
          </h1>
        </div>
        <div className="card card-pad" style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 22, lineHeight: 1.75 }}>
          {SECTIONS.map((s) => (
            <section key={s.title[1]}>
              <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>{pick(...s.title)}</h2>
              <ul style={{ margin: 0, paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {s.body.map((b) => (
                  <li key={b[1]}>{pick(...b)}</li>
                ))}
              </ul>
            </section>
          ))}
          <p style={{ margin: 0, color: 'var(--ink-muted)' }}>
            {pick('لديك سؤال؟ ', 'Questions? ')}
            <a href={wa(pick('أهلًا Petalya! لدي سؤال بخصوص الخصوصية.', 'Hi Petalya! I have a privacy question.'))} target="_blank" rel="noopener">
              {pick('راسلنا على واتساب', 'Message us on WhatsApp')}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
