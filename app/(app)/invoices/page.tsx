import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus, FileText, ExternalLink, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import type { InvoiceSync } from '@/lib/types';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Invoices' };

function statusBadge(status: string) {
  const cfg: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
    synced:  { label: 'Synced',  cls: 'bg-primary/10 text-primary',    Icon: CheckCircle2 },
    pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', Icon: Clock },
    failed:  { label: 'Failed',  cls: 'bg-destructive/10 text-destructive', Icon: XCircle },
  };
  const { label, cls, Icon } = cfg[status] ?? cfg.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function formatDateRange(from: string | null, to: string | null) {
  if (!from || !to) return '—';
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(from)} – ${fmt(to)}`;
}

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single();

  const userPlan = getEffectivePlan((profile?.plan ?? 'free') as Plan, profile?.plan_expires_at ?? null);

  if (userPlan === 'free') {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Invoices" subtitle="BillCraft AI invoice sync history" />
        <UpgradePrompt feature="billcraft_sync" requiredPlan="solo" />
      </div>
    );
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  const workspaceId = member?.workspace_id;

  const { data: syncs } = workspaceId
    ? await supabase
        .from('invoices_sync')
        .select(`*, project:projects(id, name, color)`)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(100)
    : { data: [] };

  const invoices = (syncs ?? []) as (InvoiceSync & { project?: { id: string; name: string; color: string } | null })[];

  // Check if BillCraft is connected
  const { data: bcSettings } = workspaceId
    ? await supabase
        .from('integration_settings')
        .select('enabled')
        .eq('workspace_id', workspaceId)
        .eq('integration_type', 'billcraft')
        .single()
    : { data: null };

  const billcraftConnected = bcSettings?.enabled ?? false;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Invoices"
        subtitle="Billable time synced to BillCraft AI"
        actions={
          <Link href="/invoices/new">
            <Button size="sm" disabled={!billcraftConnected}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Invoice
            </Button>
          </Link>
        }
      />

      {!billcraftConnected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">BillCraft not connected</p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            <Link href="/integrations/billcraft" className="underline">Connect BillCraft AI</Link>
            {' '}to start creating invoices from tracked time.
          </p>
        </div>
      )}

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description={
            billcraftConnected
              ? "Create your first invoice by selecting billable time entries."
              : "Connect BillCraft AI to start syncing invoices."
          }
          action={
            billcraftConnected
              ? <Link href="/invoices/new"><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />New Invoice</Button></Link>
              : <Link href="/integrations/billcraft"><Button size="sm" variant="outline">Connect BillCraft</Button></Link>
          }
        />
      ) : (
        <div className="tc-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Period</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Project</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Hours</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{inv.invoice_number ?? inv.billcraft_invoice_id.slice(0, 12)}</p>
                    {inv.entry_count > 0 && (
                      <p className="text-[11px] text-muted-foreground">{inv.entry_count} entr{inv.entry_count === 1 ? 'y' : 'ies'}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateRange(inv.date_from, inv.date_to)}
                  </td>
                  <td className="px-4 py-3">
                    {inv.project ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ background: inv.project.color }} />
                        {inv.project.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">All projects</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">
                    {inv.total_hours != null ? `${Number(inv.total_hours).toFixed(2)} h` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums">
                    {inv.total_amount != null
                      ? new Intl.NumberFormat(undefined, { style: 'currency', currency: inv.currency }).format(Number(inv.total_amount))
                      : '—'
                    }
                  </td>
                  <td className="px-4 py-3">{statusBadge(inv.status)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(inv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://billcraft.aakasa.dev/invoices/${inv.billcraft_invoice_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors inline-flex"
                      title="View in BillCraft"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
