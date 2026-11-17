// Browser-side setup (Petalya). Loaded by Next.js before the app becomes interactive.
import posthog from 'posthog-js';

// Product analytics (PostHog). The project key is a public, write-only key meant to ship in client bundles;
// NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_HOST override it.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_ConinJZKkVZv7kBZUUYKoWEU8BEkBbVGKXQrBcVswTfe';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

if (process.env.NODE_ENV === 'production' && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // Pageviews/pageleaves on client-side route changes (App Router).
    defaults: '2025-05-24',
    person_profiles: 'identified_only',
    // Never record what customers type (names, phones, addresses).
    session_recording: { maskAllInputs: true },
  });
}
