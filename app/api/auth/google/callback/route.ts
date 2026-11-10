import { cookies } from 'next/headers';
import { mutate } from '@/lib/db';
import { safeEqual, shortId } from '@/lib/crypto';
import { appOrigin, createUserSession, normEmail, safeNext } from '@/lib/customer';
import type { User } from '@/lib/types';

type GoogleProfile = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

/** Step 2: Google sends the visitor back with a one-time code; swap it for their profile server-side. */
export async function GET(req: Request) {
  const origin = appOrigin(req);
  const url = new URL(req.url);
  const jar = await cookies();
  let saved: { state?: string; next?: string } = {};
  try {
    saved = JSON.parse(jar.get('petalya_oauth')?.value || '{}');
  } catch {}
  jar.delete('petalya_oauth');
  const next = safeNext(saved.next);
  const fail = (reason: string) => Response.redirect(`${origin}/account/login?error=${reason}&next=${encodeURIComponent(next)}`, 302);

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  if (url.searchParams.get('error')) return fail('google_cancelled');
  if (!code || !saved.state || !safeEqual(state, saved.state)) return fail('google_state');

  try {
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    }).then((r) => r.json());
    if (!tok.access_token) return fail('google_token');
    const p = (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json())) as GoogleProfile;
    if (!p.sub) return fail('google_profile');
    const email = normEmail(p.email);

    const user = await mutate((db) => {
      const now = new Date().toISOString();
      let u = db.users.find((x) => x.googleId === p.sub);
      // Link to an existing email account only when Google has verified the address.
      if (!u && email && p.email_verified) u = db.users.find((x) => x.email === email);
      if (u) {
        // An email/password account was never verified by email, so when it is claimed through Google
        // drop its password: whoever pre-registered the address can no longer sign in to it.
        if (!u.googleId && u.passwordHash) delete u.passwordHash;
        u.googleId = p.sub;
        if (!u.avatar && p.picture) u.avatar = p.picture;
        if (!u.name && p.name) u.name = p.name;
        u.lastLoginAt = now;
        return u;
      }
      const n: User = { id: 'u_' + shortId(12), name: (p.name || email.split('@')[0] || 'Petalya').slice(0, 80), email, googleId: p.sub, avatar: p.picture, createdAt: now, lastLoginAt: now };
      db.users.push(n);
      return n;
    });
    await createUserSession(user.id);
    return Response.redirect(`${origin}${next}`, 302);
  } catch (e) {
    console.error('google sign-in failed', e);
    return fail('google_failed');
  }
}
