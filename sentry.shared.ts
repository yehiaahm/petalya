// Shared Sentry settings for the browser, Node.js and Edge runtimes.
// The DSN is a public, write-only key (it is meant to ship in client bundles). NEXT_PUBLIC_SENTRY_DSN overrides it;
// setting it to an empty string turns reporting off.
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  (process.env.NODE_ENV === 'production'
    ? 'https://3edc4e735eec89db7068ee3443f774b9@o4512447745818624.ingest.de.sentry.io/4512447896748112'
    : '');

export const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production';
