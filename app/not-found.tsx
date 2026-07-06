import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '404 – Page Not Found' };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-7xl font-black text-muted-foreground/20">404</p>
      <div>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-muted-foreground text-sm mt-1">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
