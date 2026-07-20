import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ExternalLink, CheckCircle2, Zap, Settings2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { UpgradePrompt } from '@/components/shared/UpgradePrompt';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Integrations' };

const INTEGRATIONS = [
  {
    key:         'billcraft' as const,
    name:        'BillCraft AI',
    description: 'Send tracked billable hours directly to BillCraft AI and generate professional invoices in one click.',
    href:        '/integrations/billcraft',
    learnHref:   'https://billcraft.aakasa.dev',
    iconBg:      'bg-blue-100 dark:bg-blue-900/30',
    iconColor:   'text-blue-600 dark:text-blue-400',
  },
  {
    key:         'supportcraft' as const,
    name:        'SupportCraft AI',
    description: 'Convert support tickets from SupportCraft AI into TaskCraft tasks automatically. Close the loop between support and delivery.',
    href:        '/integrations/supportcraft',
    learnHref:   'https://supportcraft.aakasa.dev',
    iconBg:      'bg-violet-100 dark:bg-violet-900/30',
    iconColor:   'text-violet-600 dark:text-violet-400',
  },
];

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, intSettingsRes] = await Promise.all([
    supabase.from('profiles').select('plan, plan_expires_at').eq('id', user.id).single(),
    supabase.from('integration_settings')
      .select('integration_type, enabled')
      .in('integration_type', ['billcraft', 'supportcraft']),
  ]);

  const userPlan = getEffectivePlan((profileRes.data?.plan ?? 'free') as Plan, profileRes.data?.plan_expires_at ?? null);

  const connectedMap: Record<string, boolean> = {};
  for (const s of intSettingsRes.data ?? []) {
    connectedMap[s.integration_type] = s.enabled;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Integrations"
        subtitle="Connect TaskCraft AI with the tools you already use"
      />

      {userPlan === 'free' ? (
        <UpgradePrompt feature="integrations" requiredPlan="solo" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {INTEGRATIONS.map((integration) => {
            const connected = !!connectedMap[integration.key];

            return (
              <div key={integration.key} className="tc-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${integration.iconBg}`}>
                    <Zap className={`h-5 w-5 ${integration.iconColor}`} />
                  </div>
                  {connected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                </div>

                <p className="mt-3 text-sm font-semibold">{integration.name}</p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  connected
                    ? 'bg-primary/10 text-primary'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {connected ? 'Connected' : 'Available'}
                </span>

                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {integration.description}
                </p>

                <div className="mt-4 flex gap-2">
                  {connected ? (
                    <Link
                      href={integration.href}
                      className="tc-btn-secondary inline-flex items-center gap-1.5 text-xs"
                    >
                      <Settings2 className="h-3 w-3" />
                      Manage
                    </Link>
                  ) : (
                    <Link href={integration.href} className="tc-btn-primary text-xs">
                      Connect
                    </Link>
                  )}
                  <a
                    href={integration.learnHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tc-btn-secondary inline-flex items-center gap-1.5 text-xs"
                  >
                    Learn more <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
