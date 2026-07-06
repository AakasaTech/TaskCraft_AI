import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { Badge } from '@/components/ui/badge';
import { GrantFreepassForm } from './_components/GrantFreepassForm';
import { RevokeFreepassButton } from './_components/RevokeFreepassButton';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Freepass' };

interface PaidUserRow {
  id:              string;
  email:           string;
  full_name:       string | null;
  plan:            Plan;
  plan_expires_at: string | null;
}

function expiryLabel(expiresAt: string | null): { text: string; className: string } {
  if (!expiresAt) return { text: 'Permanent', className: 'text-emerald-600 dark:text-emerald-400' };
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff < 0) return { text: 'Expired', className: 'text-red-500' };
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const date = new Date(expiresAt).toLocaleDateString('en-US', { dateStyle: 'medium' });
  return {
    text: `${date} (${days}d)`,
    className: days < 14 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
  };
}

export default async function FreepassPage() {
  const supabase = createAdminClient();

  const { data: paidUsers } = await supabase
    .from('profiles')
    .select('id, email, full_name, plan, plan_expires_at')
    .neq('plan', 'free')
    .order('plan_expires_at', { ascending: true, nullsFirst: false })
    .limit(200);

  const rows = (paidUsers ?? []) as PaidUserRow[];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Freepass</h1>
        <p className="page-subtitle">Grant complimentary paid access to users</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Grant form */}
        <GrantFreepassForm />

        {/* Active paid users */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Paid users</h2>
            <span className="text-xs text-muted-foreground">{rows.length} total</span>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No paid users yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">User</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Plan</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Expires</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Revoke</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => {
                    const expiry = expiryLabel(u.plan_expires_at);
                    return (
                      <tr key={u.id} className="border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-medium leading-tight">{u.full_name ?? '—'}</p>
                          <p className="text-[11px] text-muted-foreground">{u.email}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="default" className="capitalize text-[11px]">{u.plan}</Badge>
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <span className={`text-xs ${expiry.className}`}>{expiry.text}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <RevokeFreepassButton userId={u.id} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
