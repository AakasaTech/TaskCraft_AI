import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingUp, CreditCard, Activity } from 'lucide-react';

export const metadata: Metadata = { title: 'Admin Overview' };

export default async function AdminOverviewPage() {
  const supabase = createAdminClient();

  const [
    { count: totalUsers },
    { count: paidUsers },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('plan', 'free'),
  ]);

  const stats = [
    { label: 'Total Users',  value: totalUsers ?? 0, icon: Users,      color: 'text-blue-600' },
    { label: 'Paid Users',   value: paidUsers ?? 0,  icon: CreditCard, color: 'text-green-600' },
    { label: 'Free Users',   value: (totalUsers ?? 0) - (paidUsers ?? 0), icon: Activity, color: 'text-purple-600' },
    { label: 'Conversion',   value: totalUsers ? `${Math.round(((paidUsers ?? 0) / totalUsers) * 100)}%` : '0%', icon: TrendingUp, color: 'text-primary' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Admin Overview</h1>
        <p className="page-subtitle">Platform health and user metrics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
