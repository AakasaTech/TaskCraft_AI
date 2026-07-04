import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-[88px] w-auto" aria-hidden="true" />
          <span className="text-lg font-bold tracking-tight">TaskCraft AI</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
          <Link href="/#pricing"  className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/faq"       className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className="hidden text-sm text-muted-foreground hover:text-foreground transition-colors sm:block">
            Sign in
          </Link>
          <Link href="/register" className="tc-btn-primary px-4 py-2 rounded-lg text-sm">
            Start free
          </Link>
        </div>
      </nav>
    </header>
  );
}
