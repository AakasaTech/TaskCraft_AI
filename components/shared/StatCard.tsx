import { type ElementType } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ElementType;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; label: string };
}

export function StatCard({ title, value, subtitle, icon: Icon, iconColor, iconBg, trend }: StatCardProps) {
  const trendUp   = (trend?.value ?? 0) > 0;
  const trendFlat = (trend?.value ?? 0) === 0;

  return (
    <div className="tc-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                trendFlat  && 'bg-slate-100 text-slate-500 dark:bg-slate-800/60',
                trendUp    && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                !trendUp && !trendFlat && 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
              )}
            >
              {trendFlat  ? <Minus className="h-3 w-3" />
               : trendUp  ? <TrendingUp className="h-3 w-3" />
               :             <TrendingDown className="h-3 w-3" />}
              {trendFlat ? 'No change' : `${Math.abs(trend.value)}% ${trend.label}`}
            </div>
          )}
        </div>
        <div
          className={cn(
            'stat-card-icon shrink-0',
            iconBg ?? 'bg-primary/10',
          )}
        >
          <Icon className={cn('h-5 w-5', iconColor ?? 'text-primary')} />
        </div>
      </div>
    </div>
  );
}
