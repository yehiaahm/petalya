import { cookies } from 'next/headers';
import { randomSecret } from '@/lib/crypto';
import { appOrigin, googleConfigured, safeNext } from '@/lib/customer';

/** Step 1 of Google sign-in: send the visitor to Google's consent screen. */
export async function GET(req: Request) {
  const origin = appOrigin(req);
  const next = safeNext(new URL(req.url).searchParams.get('next'));
  if (!googleConfigured()) return Response.redirect(`${origin}/account/login?error=google_off&next=${encodeURIComponent(next)}`, 302);
  const state = randomSecret(16);
  (await cookies()).set('petalya_oauth', JSON.stringify({ state, next }), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, 302);
}
