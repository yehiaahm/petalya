'use client';

import { useSite } from './SiteProvider';
import { MiniHeader } from './Checkout';

type Section = { title: [string, string]; body: [string, string][] };

const SECTIONS: Section[] = [
  {
    title: ['بنجمع إيه', 'What we collect'],
    body: [
      ['لما تطلب: اسمك، رقم موبايلك، عنوان التوصيل، وتفاصيل الطلب.', 'When you order: your name, mobile number, delivery address and the order details.'],
      ['لما تعمل حساب: اسمك وإيميلك، وكلمة سر محفوظة بشكل مشفّر (مش بنقدر نشوفها).', 'When you create an account: your name and email, and a password stored only as a secure hash (we can’t read it).'],
      ['لما تدخل بجوجل: جوجل بيبعتلنا اسمك وإيميلك وصورة حسابك بس. مش بنوصل لأي حاجة تانية في حسابك.', 'When you sign in with Google: Google shares only your name, email address and profile picture. We get no other access to your Google account.'],
      ['إحصائيات زيارة بسيطة (الصفحات اللي اتفتحت) من غير إعلانات ولا تتبّع من شركات تانية.', 'Simple visit statistics (which pages were opened), with no ads and no third-party trackers.'],
    ],
  },
  {
    title: ['بنستخدمها في إيه', 'How we use it'],
    body: [
      ['علشان نجهّز طلبك ونوصّله ونكلّمك عليه (غالباً على واتساب).', 'To prepare and deliver your order and contact you about it (usually on WhatsApp).'],
      ['علشان نملالك بياناتك تلقائي في الطلبات الجاية ونوريك طلباتك القديمة.', 'To fill in your details automatically next time and show you your past orders.'],
      ['مش بنبيع بياناتك ولا بنشاركها مع حد، غير اللي محتاجه التوصيل.', 'We never sell or share your data with anyone, except what delivery requires.'],
    ],
  },
  {
    title: ['حقوقك', 'Your choices'],
    body: [
      ['تقدر تعدّل بياناتك من صفحة حسابك في أي وقت.', 'You can edit your details from your account page at any time.'],
      ['لو عايز نمسح حسابك وبياناتك، ابعتلنا على واتساب وهنمسحها.', 'To have your account and data deleted, message us on WhatsApp and we’ll remove it.'],
      ['تقدر تشيل صلاحية Petalya من حساب جوجل بتاعك من myaccount.google.com/permissions.', 'You can remove Petalya’s access from your Google account at myaccount.google.com/permissions.'],
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
            {pick('عندك سؤال؟ ', 'Questions? ')}
            <a href={wa(pick('أهلاً Petalya! عندي سؤال عن الخصوصية.', 'Hi Petalya! I have a privacy question.'))} target="_blank" rel="noopener">
              {pick('كلّمنا على واتساب', 'Message us on WhatsApp')}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
