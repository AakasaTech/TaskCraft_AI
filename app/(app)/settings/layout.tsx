'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/settings',               label: 'Profile' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/billing',       label: 'Billing' },
  { href: '/settings/security',      label: 'Security' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      {/* Side nav */}
      <nav className="shrink-0 lg:w-44">
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:space-y-0.5">
          {TABS.map((tab) => {
            const active = tab.href === '/settings'
              ? pathname === '/settings'
              : pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={cn(
                    'block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Page content */}
      <div className="min-w-0 flex-1 animate-fade-in">{children}</div>
    </div>
  );
}
