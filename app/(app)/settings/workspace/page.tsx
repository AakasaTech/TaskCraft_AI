import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { WorkspaceSettingsClient } from './_components/WorkspaceSettingsClient';

export const metadata: Metadata = { title: 'Workspace Settings' };

export default async function WorkspaceSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member?.workspace_id) redirect('/settings');

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, avatar_url, settings')
    .eq('id', member.workspace_id)
    .single();

  if (!workspace) redirect('/settings');

  const canEdit = ['owner', 'admin'].includes(member.role ?? '');

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Workspace" subtitle="Manage your workspace name, branding, and regional preferences." />

      <WorkspaceSettingsClient
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        avatarUrl={workspace.avatar_url ?? null}
        settings={(workspace.settings ?? {}) as Record<string, unknown>}
        canEdit={canEdit}
      />
    </div>
  );
}
