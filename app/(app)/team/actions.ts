'use server';

import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getWorkspaceCtx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) throw new Error('No workspace found');
  return { user, supabase, workspaceId: membership.workspace_id, role: membership.role as string };
}

function canManage(role: string) { return role === 'owner' || role === 'admin'; }

// ── Invite member ─────────────────────────────────────────────────────────────

export async function inviteMember(email: string, role: string) {
  const { user, workspaceId, role: currentRole } = await getWorkspaceCtx();
  if (!canManage(currentRole)) return { error: 'Insufficient permissions' };

  const admin = createAdminClient();

  // Check if email is already a member
  const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (profile) {
    const { data: existing } = await admin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', profile.id)
      .maybeSingle();
    if (existing) return { error: 'This user is already a workspace member' };
  }

  // Check for pending invite
  const { data: pending } = await admin
    .from('workspace_invitations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('email', email)
    .is('accepted_at', null)
    .maybeSingle();
  if (pending) return { error: 'An invitation is already pending for this email' };

  const token = randomBytes(32).toString('hex');
  const { error } = await admin.from('workspace_invitations').insert({
    workspace_id: workspaceId,
    email,
    role,
    token,
    invited_by: user.id,
  });

  if (error) return { error: 'Failed to create invitation' };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  revalidatePath('/team');
  return { data: { inviteUrl: `${base}/team/invite?token=${token}` } };
}

// ── Cancel invitation ─────────────────────────────────────────────────────────

export async function cancelInvitation(id: string) {
  const { workspaceId, role } = await getWorkspaceCtx();
  if (!canManage(role)) return { error: 'Insufficient permissions' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('workspace_invitations')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) return { error: 'Failed to cancel invitation' };
  revalidatePath('/team');
  return { data: { ok: true } };
}

// ── Remove member ─────────────────────────────────────────────────────────────

export async function removeMember(memberId: string) {
  const { user, workspaceId, role } = await getWorkspaceCtx();
  if (!canManage(role)) return { error: 'Insufficient permissions' };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!target) return { error: 'Member not found' };
  if (target.user_id === user.id) return { error: 'You cannot remove yourself' };
  if (target.role === 'owner') return { error: 'Cannot remove the workspace owner' };
  if (target.role === 'admin' && role !== 'owner') return { error: 'Only the owner can remove admins' };

  const { error } = await admin
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', workspaceId);

  if (error) return { error: 'Failed to remove member' };
  revalidatePath('/team');
  return { data: { ok: true } };
}

// ── Change member role ────────────────────────────────────────────────────────

export async function changeMemberRole(memberId: string, newRole: string) {
  const { user, workspaceId, role } = await getWorkspaceCtx();
  if (!canManage(role)) return { error: 'Insufficient permissions' };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!target) return { error: 'Member not found' };
  if (target.user_id === user.id) return { error: 'You cannot change your own role' };
  if (target.role === 'owner') return { error: "Cannot change the owner's role" };
  if (target.role === 'admin' && role !== 'owner') return { error: 'Only the owner can change admin roles' };
  if (newRole === 'owner') return { error: 'Cannot assign the owner role' };

  const { error } = await admin
    .from('workspace_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .eq('workspace_id', workspaceId);

  if (error) return { error: 'Failed to update role' };
  revalidatePath('/team');
  return { data: { ok: true } };
}

// ── Accept invitation ─────────────────────────────────────────────────────────

export async function acceptInvitation(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/team/invite?token=${token}`);

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from('workspace_invitations')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!invite) return { error: 'This invitation is invalid or has expired' };

  // Already a member?
  const { data: existing } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await admin.from('workspace_invitations').update({ accepted_at: new Date().toISOString() }).eq('token', token);
    return { data: { workspaceId: invite.workspace_id, alreadyMember: true } };
  }

  const { error: insertErr } = await admin.from('workspace_members').insert({
    workspace_id: invite.workspace_id,
    user_id: user.id,
    role: invite.role,
    invited_by: invite.invited_by,
    invited_at: invite.created_at,
    joined_at: new Date().toISOString(),
  });

  if (insertErr) return { error: 'Failed to join workspace' };

  await admin.from('workspace_invitations').update({ accepted_at: new Date().toISOString() }).eq('token', token);
  return { data: { workspaceId: invite.workspace_id } };
}

// ── Workload data ─────────────────────────────────────────────────────────────

export interface WorkloadMember {
  user_id:       string;
  full_name:     string | null;
  avatar_url:    string | null;
  email:         string;
  role:          string;
  taskCounts:    Record<string, number>;
  totalTasks:    number;
  hoursThisMonth: number;
}

export async function getWorkloadData(): Promise<{ data?: WorkloadMember[]; error?: string }> {
  const { workspaceId } = await getWorkspaceCtx();
  const admin = createAdminClient();

  const [membersRes, tasksRes, timeRes] = await Promise.all([
    admin.from('workspace_members').select('user_id, role, profiles(full_name, avatar_url, email)').eq('workspace_id', workspaceId),
    admin.from('tasks').select('assignee_id, status').eq('workspace_id', workspaceId).not('assignee_id', 'is', null),
    admin.from('time_entries')
      .select('user_id, duration_minutes')
      .eq('workspace_id', workspaceId)
      .gte('start_time', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      .not('duration_minutes', 'is', null),
  ]);

  const tasksByUser: Record<string, Record<string, number>> = {};
  for (const t of tasksRes.data ?? []) {
    if (!t.assignee_id) continue;
    tasksByUser[t.assignee_id] ??= {};
    tasksByUser[t.assignee_id][t.status] = (tasksByUser[t.assignee_id][t.status] ?? 0) + 1;
  }

  const hoursByUser: Record<string, number> = {};
  for (const e of timeRes.data ?? []) {
    hoursByUser[e.user_id] = (hoursByUser[e.user_id] ?? 0) + (e.duration_minutes ?? 0) / 60;
  }

  const data: WorkloadMember[] = (membersRes.data ?? []).map((m) => {
    const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as any;
    const counts = tasksByUser[m.user_id] ?? {};
    return {
      user_id: m.user_id,
      full_name: p?.full_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      email: p?.email ?? '',
      role: m.role,
      taskCounts: counts,
      totalTasks: Object.values(counts).reduce((a, b) => a + b, 0),
      hoursThisMonth: Math.round((hoursByUser[m.user_id] ?? 0) * 10) / 10,
    };
  });

  return { data };
}

// ── Timesheet data ────────────────────────────────────────────────────────────

export interface TimesheetEntry {
  id:               string;
  description:      string | null;
  start_time:       string;
  duration_minutes: number;
  billable:         boolean;
  project_name:     string | null;
  project_color:    string | null;
  task_title:       string | null;
}

export interface TimesheetRow {
  user_id:         string;
  full_name:       string | null;
  avatar_url:      string | null;
  entries:         TimesheetEntry[];
  totalMinutes:    number;
  billableMinutes: number;
}

export async function getTimesheetData(
  dateFrom: string,
  dateTo: string,
): Promise<{ data?: TimesheetRow[]; error?: string }> {
  const { workspaceId } = await getWorkspaceCtx();
  const admin = createAdminClient();

  const [membersRes, entriesRes] = await Promise.all([
    admin.from('workspace_members').select('user_id, profiles(full_name, avatar_url)').eq('workspace_id', workspaceId),
    admin.from('time_entries')
      .select('id, user_id, description, start_time, duration_minutes, billable, projects(name, color), tasks(title)')
      .eq('workspace_id', workspaceId)
      .gte('start_time', dateFrom)
      .lte('start_time', dateTo + 'T23:59:59')
      .not('duration_minutes', 'is', null)
      .order('start_time', { ascending: false }),
  ]);

  const byUser: Record<string, typeof entriesRes.data> = {};
  for (const e of entriesRes.data ?? []) {
    byUser[e.user_id] ??= [];
    byUser[e.user_id]!.push(e);
  }

  const data: TimesheetRow[] = (membersRes.data ?? [])
    .filter((m) => (byUser[m.user_id]?.length ?? 0) > 0)
    .map((m) => {
      const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as any;
      const entries = (byUser[m.user_id] ?? []).map((e) => ({
        id: e.id,
        description: e.description,
        start_time: e.start_time,
        duration_minutes: e.duration_minutes ?? 0,
        billable: e.billable,
        project_name: (e.projects as any)?.name ?? null,
        project_color: (e.projects as any)?.color ?? null,
        task_title: (e.tasks as any)?.title ?? null,
      }));
      const totalMinutes = entries.reduce((s, x) => s + x.duration_minutes, 0);
      const billableMinutes = entries.filter((x) => x.billable).reduce((s, x) => s + x.duration_minutes, 0);
      return { user_id: m.user_id, full_name: p?.full_name ?? null, avatar_url: p?.avatar_url ?? null, entries, totalMinutes, billableMinutes };
    });

  return { data };
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id:         string;
  task_id:    string;
  task_title: string;
  user_id:    string | null;
  full_name:  string | null;
  avatar_url: string | null;
  action:     string;
  old_value:  unknown;
  new_value:  unknown;
  created_at: string;
}

export async function getActivityFeed(
  limit = 50,
  memberId?: string,
): Promise<{ data?: ActivityEntry[]; error?: string }> {
  const { workspaceId } = await getWorkspaceCtx();
  const admin = createAdminClient();

  // Get task IDs in workspace
  const { data: wTasks } = await admin
    .from('tasks')
    .select('id')
    .eq('workspace_id', workspaceId)
    .limit(2000);

  const taskIds = (wTasks ?? []).map((t) => t.id);
  if (taskIds.length === 0) return { data: [] };

  let q = admin
    .from('task_activity')
    .select('id, task_id, user_id, action, old_value, new_value, created_at, tasks(title)')
    .in('task_id', taskIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (memberId) q = q.eq('user_id', memberId);

  const { data: activities, error } = await q;
  if (error) return { error: error.message };

  // Fetch profiles for unique user IDs
  const userIds = [...new Set((activities ?? []).filter((a) => a.user_id).map((a) => a.user_id!))];
  const { data: profiles } = userIds.length > 0
    ? await admin.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
    : { data: [] };

  const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> =
    Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const data: ActivityEntry[] = (activities ?? []).map((a) => ({
    id: a.id,
    task_id: a.task_id,
    task_title: (a.tasks as any)?.title ?? 'Unknown task',
    user_id: a.user_id,
    full_name: a.user_id ? (profileMap[a.user_id]?.full_name ?? null) : null,
    avatar_url: a.user_id ? (profileMap[a.user_id]?.avatar_url ?? null) : null,
    action: a.action,
    old_value: a.old_value,
    new_value: a.new_value,
    created_at: a.created_at,
  }));

  return { data };
}
