import type { Metadata } from 'next';
import { Users, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';

export const metadata: Metadata = { title: 'Clients' };

export default function ClientsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Clients"
        subtitle="Manage clients and link them to projects for billing"
        actions={
          <button className="tc-btn-primary" disabled>
            <Plus className="h-3.5 w-3.5" />
            Add Client
          </button>
        }
      />

      <div className="tc-card">
        <div className="empty-state py-24">
          <div className="empty-state-icon">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold">Clients coming soon</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Manage your clients here, link them to projects, and send invoices directly to
            BillCraft AI with a single click.
          </p>
          <span className="mt-5 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Phase 3
          </span>
        </div>
      </div>
    </div>
  );
}
