import Link from 'next/link';

export function PublicFooter() {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Row 1: logo + copyright + links */}
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/">
            <img src="/logo.png" alt="TaskCraft AI" className="h-16 w-auto" />
          </Link>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TaskCraft AI. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/faq"     className="hover:text-foreground transition-colors">FAQ</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms"   className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>

        {/* Row 2: built-by + cross-promo */}
        <div className="flex flex-col items-center justify-between gap-2 border-t border-border/50 pt-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            Built by{' '}
            <a href="https://aakasa.dev" className="font-medium hover:text-foreground transition-colors">
              Aakasa Digital
            </a>
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground sm:justify-end">
            <a href="https://billcraft.aakasa.dev" className="hover:text-foreground transition-colors">
              Also try BillCraft AI — AI-powered invoicing →
            </a>
            <a href="https://supportcraft.aakasa.dev" className="hover:text-foreground transition-colors">
              Also try SupportCraft AI — AI help desk →
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
