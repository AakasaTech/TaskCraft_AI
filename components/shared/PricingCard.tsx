import { Check, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PricingCardProps {
  name: string;
  price: number;
  yearlyPrice?: number;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  ctaLabel?: string;
  ctaHref?: string;
  billingCycle?: 'monthly' | 'yearly';
}

export function PricingCard({
  name,
  price,
  yearlyPrice,
  description,
  features,
  highlighted = false,
  badge,
  ctaLabel = 'Get started',
  ctaHref = '/register',
  billingCycle = 'monthly',
}: PricingCardProps) {
  const displayPrice = billingCycle === 'yearly' && yearlyPrice != null ? yearlyPrice : price;
  const isYearly     = billingCycle === 'yearly';
  const isFree       = price === 0;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border p-6 transition-shadow',
        highlighted
          ? 'border-primary shadow-xl shadow-primary/10'
          : 'border-border bg-card shadow-sm hover:shadow-md',
      )}
    >
      {/* Gradient overlay for highlighted */}
      {highlighted && (
        <div
          className="absolute inset-0 -z-10 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, hsl(250 84% 60% / 0.04) 0%, hsl(270 70% 60% / 0.04) 100%)' }}
        />
      )}

      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, hsl(250 84% 60%) 0%, hsl(270 70% 60%) 100%)' }}>
            <Zap className="h-3 w-3" />
            {badge}
          </span>
        </div>
      )}

      {/* Plan name & desc */}
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>

      {/* Price */}
      <div className="mt-4 flex items-baseline gap-1">
        {isFree ? (
          <span className="text-3xl font-bold">Free</span>
        ) : (
          <>
            <span className="text-xs font-medium text-muted-foreground">$</span>
            <span className="text-3xl font-bold tabular-nums">
              {isYearly ? displayPrice : displayPrice}
            </span>
            <span className="text-xs text-muted-foreground">
              {isYearly ? '/year' : '/month'}
            </span>
          </>
        )}
      </div>
      {isYearly && !isFree && yearlyPrice != null && (
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          ≈ ${Math.round(yearlyPrice / 12)}/month · billed annually
        </p>
      )}

      {/* CTA */}
      <a
        href={ctaHref}
        className={cn(
          'mt-5 block rounded-xl py-2.5 text-center text-sm font-semibold transition-all active:scale-[0.98]',
          highlighted
            ? 'tc-btn-primary w-full'
            : 'tc-btn-secondary w-full',
        )}
      >
        {ctaLabel}
      </a>

      {/* Features */}
      <ul className="mt-6 space-y-3">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <Check
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                highlighted ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
