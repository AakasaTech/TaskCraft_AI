import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/PageHeader';
import { WorkspaceSettingsClient } from './_components/WorkspaceSettingsClient';

export const metadata: Metadata = { title: 'Workspace Settings' };

export default async function WorkspaceSettingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const workspace = currentUser.workspace;
  const canEdit = ['owner', 'admin'].includes(currentUser.membership.role);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Workspace" subtitle="Manage your workspace name, branding, and regional preferences." />

      <WorkspaceSettingsClient
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        avatarUrl={workspace.avatarUrl ?? null}
        settings={(workspace.settings ?? {}) as Record<string, unknown>}
        canEdit={canEdit}
      />
    </div>
  );
}
