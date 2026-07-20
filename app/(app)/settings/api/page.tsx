import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/shared/PageHeader';
import { ApiKeysClient } from './_components/ApiKeysClient';
import type { ApiKey, Webhook, Plan } from '@/lib/types';
import { getEffectivePlan } from '@/lib/plan-gates';

export const metadata: Metadata = { title: 'API & Webhooks' };

export default async function ApiSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .single();

  const plan = getEffectivePlan((profile?.plan ?? 'free') as Plan, profile?.plan_expires_at ?? null);

  if (!member?.workspace_id || !['owner', 'admin'].includes(member.role)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="API & Webhooks" subtitle="Manage API keys and webhook integrations." />
        <p className="text-sm text-muted-foreground">
          Only workspace owners and admins can manage API keys and webhooks.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const [keysRes, webhooksRes] = await Promise.all([
    admin
      .from('api_keys')
      .select('id, name, key_prefix, scopes, last_used_at, expires_at, created_at')
      .eq('workspace_id', member.workspace_id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false }),
    admin
      .from('webhooks')
      .select('id, name, url, events, active, last_fired_at, created_at')
      .eq('workspace_id', member.workspace_id)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="API & Webhooks"
        subtitle="Authenticate with API keys and receive real-time events via webhooks."
      />

      <ApiKeysClient
        apiKeys={(keysRes.data ?? []) as ApiKey[]}
        webhooks={(webhooksRes.data ?? []) as Webhook[]}
        plan={plan}
      />
    </div>
  );
}
