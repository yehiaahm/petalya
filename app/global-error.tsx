'use client';

// Last-resort error screen for errors thrown in a root layout. Reports the error to Sentry.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', background: '#111', color: '#eee' }}>
        <main style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong · حصلت مشكلة</h1>
          <button type="button" onClick={reset} style={{ marginTop: 16, minHeight: 44, padding: '0 20px', cursor: 'pointer' }}>
            Try again · حاول تاني
          </button>
        </main>
      </body>
    </html>
  );
}
