// Browser-side Sentry setup (Petalya). Loaded by Next.js before the app becomes interactive.
import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, SENTRY_ENVIRONMENT } from './sentry.shared';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: 0.1,
    // Noise from extensions, in-app browsers and flaky mobile networks.
    ignoreErrors: ['ResizeObserver loop', 'Non-Error promise rejection captured', /^Load failed$/, /ChunkLoadError/],
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//],
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
