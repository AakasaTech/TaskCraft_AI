import type { Metadata } from 'next';
import { ExternalLink, CheckCircle2, Zap } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

export const metadata: Metadata = { title: 'Integrations' };

const INTEGRATIONS = [
  {
    name:        'BillCraft AI',
    description: 'Send tracked billable hours directly to BillCraft AI and generate professional invoices in one click.',
    href:        'https://billcraft.aakasa.dev',
    badge:       'Available',
    iconBg:      'bg-blue-100 dark:bg-blue-900/30',
    iconColor:   'text-blue-600 dark:text-blue-400',
    connected:   false,
  },
  {
    name:        'SupportCraft AI',
    description: 'Convert support tickets from SupportCraft AI into TaskCraft tasks automatically. Close the loop between support and delivery.',
    href:        'https://supportcraft.aakasa.dev',
    badge:       'Available',
    iconBg:      'bg-violet-100 dark:bg-violet-900/30',
    iconColor:   'text-violet-600 dark:text-violet-400',
    connected:   false,
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Integrations"
        subtitle="Connect TaskCraft AI with the tools you already use"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {INTEGRATIONS.map((integration) => (
          <div key={integration.name} className="tc-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${integration.iconBg}`}>
                <Zap className={`h-5 w-5 ${integration.iconColor}`} />
              </div>
              {integration.connected && (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              )}
            </div>

            <p className="mt-3 text-sm font-semibold">{integration.name}</p>
            <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {integration.badge}
            </span>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {integration.description}
            </p>

            <div className="mt-4 flex gap-2">
              {integration.connected ? (
                <button className="tc-btn-secondary text-xs border-destructive/30 text-destructive">
                  Disconnect
                </button>
              ) : (
                <button className="tc-btn-primary text-xs">Connect</button>
              )}
              <a
                href={integration.href}
                target="_blank"
                rel="noopener noreferrer"
                className="tc-btn-secondary inline-flex items-center gap-1.5 text-xs"
              >
                Learn more <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
