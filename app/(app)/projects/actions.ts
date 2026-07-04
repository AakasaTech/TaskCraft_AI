'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { ProjectStatus, ProjectMemberRole } from '@/lib/types';
import { PLANS } from '@/lib/constants';

export interface ProjectInput {
  name: string;
  description?: string;
  color: string;
  status: ProjectStatus;
  client_id?: string;
  start_date?: string;
  due_date?: string;
  budget?: number | null;
  hourly_rate?: number | null;
  billable: boolean;
}

async function getWorkspaceId(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.workspace_id ?? null;
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createProject(input: ProjectInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  if (!input.name?.trim()) return { error: 'Project name is required.' };

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return { error: 'No workspace found.' };

  // Enforce plan project limit
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  const planKey = (profile?.plan ?? 'free') as keyof typeof PLANS;
  const limit   = PLANS[planKey].max_projects;

  if (limit !== -1) {
    const { count } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .neq('status', 'archived');

    if ((count ?? 0) >= limit) {
      return {
        error: `Your ${PLANS[planKey].name} plan allows up to ${limit} active project${limit !== 1 ? 's' : ''}. Archive a project or upgrade your plan to create more.`,
        limitReached: true,
      };
    }
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      created_by:   user.id,
      name:         input.name.trim(),
      description:  input.description?.trim() || null,
      color:        input.color,
      status:       input.status,
      client_id:    input.client_id || null,
      start_date:   input.start_date || null,
      due_date:     input.due_date || null,
      budget:       input.budget ?? null,
      hourly_rate:  input.hourly_rate ?? null,
      billable:     input.billable,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/projects');
  return { data };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateProject(id: string, input: Partial<ProjectInput>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const patch: Record<string, unknown> = {};
  if (input.name         !== undefined) patch.name         = input.name.trim();
  if (input.description  !== undefined) patch.description  = input.description?.trim() || null;
  if (input.color        !== undefined) patch.color        = input.color;
  if (input.status       !== undefined) patch.status       = input.status;
  if (input.client_id    !== undefined) patch.client_id    = input.client_id || null;
  if (input.start_date   !== undefined) patch.start_date   = input.start_date || null;
  if (input.due_date     !== undefined) patch.due_date     = input.due_date || null;
  if (input.budget       !== undefined) patch.budget       = input.budget ?? null;
  if (input.hourly_rate  !== undefined) patch.hourly_rate  = input.hourly_rate ?? null;
  if (input.billable     !== undefined) patch.billable     = input.billable;

  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/projects');
  revalidatePath(`/projects/${id}`);
  return { data };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/projects');
  return { success: true };
}

// ── Archive / restore ─────────────────────────────────────────────────────────

export async function archiveProject(id: string) {
  return updateProject(id, { status: 'archived' });
}

export async function restoreProject(id: string) {
  return updateProject(id, { status: 'not_started' });
}

// ── Project members ───────────────────────────────────────────────────────────

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole = 'member',
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data, error } = await supabase
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, role })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { data };
}

export async function removeProjectMember(projectId: string, userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
