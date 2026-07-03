import Link from 'next/link';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Link href="/">
            <img src="/logo.png" alt="TaskCraft AI" className="h-32 w-auto" />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
