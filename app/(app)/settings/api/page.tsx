import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/PageHeader';
import { ApiKeysClient } from './_components/ApiKeysClient';
import type { ApiKey, Webhook, Plan } from '@/lib/types';
import { getEffectivePlan } from '@/lib/plan-gates';

export const metadata: Metadata = { title: 'API & Webhooks' };

export default async function ApiSettingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const plan = getEffectivePlan(
    currentUser.profile.plan as Plan,
    currentUser.profile.planExpiresAt?.toISOString() ?? null
  );

  if (!['owner', 'admin'].includes(currentUser.membership.role)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="API & Webhooks" subtitle="Manage API keys and webhook integrations." />
        <p className="text-sm text-muted-foreground">
          Only workspace owners and admins can manage API keys and webhooks.
        </p>
      </div>
    );
  }

  const workspaceId = currentUser.workspace.id;

  const [keysRes, webhooksRes] = await Promise.all([
    prisma.apiKey.findMany({
      where: {
        workspaceId,
        revokedAt: null,
      },
      select: {
        id:         true,
        name:       true,
        keyPrefix:  true,
        scopes:     true,
        lastUsedAt: true,
        expiresAt:  true,
        createdAt:  true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.webhook.findMany({
      where: { workspaceId },
      select: {
        id:          true,
        name:        true,
        url:         true,
        events:      true,
        active:      true,
        lastFiredAt: true,
        createdAt:   true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const apiKeys: ApiKey[] = keysRes.map((k) => ({
    id:           k.id,
    workspace_id: workspaceId,
    user_id:      currentUser.profile.id,
    name:         k.name,
    key_prefix:   k.keyPrefix,
    scopes:       k.scopes as any,
    last_used_at: k.lastUsedAt?.toISOString() ?? null,
    expires_at:   k.expiresAt?.toISOString() ?? null,
    revoked_at:   null,
    created_at:   k.createdAt.toISOString(),
  }));

  const webhooks: Webhook[] = webhooksRes.map((w) => ({
    id:            w.id,
    workspace_id:  workspaceId,
    user_id:       currentUser.profile.id,
    name:          w.name,
    url:           w.url,
    events:        w.events as any,
    active:        w.active,
    last_fired_at: w.lastFiredAt?.toISOString() ?? null,
    created_at:    w.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="API & Webhooks"
        subtitle="Authenticate with API keys and receive real-time events via webhooks."
      />

      <ApiKeysClient
        apiKeys={apiKeys}
        webhooks={webhooks}
        plan={plan}
      />
    </div>
  );
}
