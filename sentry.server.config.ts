// Node.js-side Sentry setup (Petalya): API routes, server components, server actions.
import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, SENTRY_ENVIRONMENT } from './sentry.shared';

const dsn = process.env.SENTRY_DSN ?? SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || SENTRY_ENVIRONMENT,
    release: process.env.RAILWAY_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
  });
}
