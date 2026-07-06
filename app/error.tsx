'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm max-w-sm">
            An unexpected error occurred. Our team has been notified.
          </p>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors"
            >
              Go to dashboard
            </Link>
          </div>
          {error.digest && (
            <p className="text-[11px] text-muted-foreground font-mono">Error ID: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
