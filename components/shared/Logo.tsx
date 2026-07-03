import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  href?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const HEIGHT: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-12',
};

export function Logo({ href = '/', className, size = 'md' }: LogoProps) {
  const content = (
    <span className={cn('flex items-center', className)}>
      <img src="/logo.png" alt="TaskCraft AI" className={cn(HEIGHT[size], 'w-auto')} />
    </span>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export function AppLogoIcon({ className }: { className?: string }) {
  return (
    <Link href="/dashboard">
      <img src="/app_icon.png" alt="TaskCraft AI" className={cn('h-8 w-8 rounded-lg object-cover', className)} />
    </Link>
  );
}
