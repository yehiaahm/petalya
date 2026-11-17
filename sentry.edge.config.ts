// Edge-runtime Sentry setup (Petalya): proxy.ts (request guard) and any edge routes.
import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, SENTRY_ENVIRONMENT } from './sentry.shared';

const dsn = process.env.SENTRY_DSN ?? SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || SENTRY_ENVIRONMENT,
    tracesSampleRate: 0.1,
  });
}
