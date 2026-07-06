'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { TaskStatus, TaskPriority } from '@/lib/types';
import { notifyTaskAssigned, notifyCommentAdded } from '@/lib/notifications';

const VALID_PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES:   readonly TaskStatus[]   = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

function sanitizePriority(p: unknown): TaskPriority {
  return VALID_PRIORITIES.includes(p as TaskPriority) ? (p as TaskPriority) : 'medium';
}
function sanitizeStatus(s: unknown): TaskStatus {
  return VALID_STATUSES.includes(s as TaskStatus) ? (s as TaskStatus) : 'todo';
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

export async function createTask(input: {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project_id?: string;
  assignee_id?: string;
  due_date?: string;
  start_date?: string;
  estimated_hours?: number | null;
  billable?: boolean;
  hourly_rate?: number | null;
  parent_task_id?: string;
  label_ids?: string[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const wid = await getWorkspaceId(user.id);
  if (!wid) return { error: 'No workspace found.' };

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id:    wid,
      created_by:      user.id,
      title:           input.title.trim(),
      description:     input.description?.trim() || null,
      status:          sanitizeStatus(input.status ?? 'todo'),
      priority:        sanitizePriority(input.priority ?? 'medium'),
      project_id:      input.project_id || null,
      assignee_id:     input.assignee_id || null,
      due_date:        input.due_date || null,
      start_date:      input.start_date || null,
      estimated_hours: input.estimated_hours ?? null,
      billable:        input.billable ?? false,
      hourly_rate:     input.hourly_rate ?? null,
      parent_task_id:  input.parent_task_id || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Assign labels
  if (input.label_ids?.length) {
    await supabase.from('task_label_assignments').insert(
      input.label_ids.map((lid) => ({ task_id: task.id, label_id: lid })),
    );
  }

  // Notify assignee if different from creator
  if (input.assignee_id && input.assignee_id !== user.id) {
    const [profileRes, projectRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      input.project_id
        ? supabase.from('projects').select('name').eq('id', input.project_id).single()
        : Promise.resolve({ data: null }),
    ]);
    notifyTaskAssigned({
      assigneeId:   input.assignee_id,
      workspaceId:  wid,
      taskId:       task.id,
      taskTitle:    task.title,
      assignerName: profileRes.data?.full_name ?? 'Someone',
      projectName:  projectRes.data?.name ?? undefined,
    }).catch(console.error);
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  return { data: task };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateTask(id: string, patch: {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project_id?: string | null;
  assignee_id?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  estimated_hours?: number | null;
  billable?: boolean;
  hourly_rate?: number | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const update: Record<string, unknown> = {};
  if (patch.title           !== undefined) update.title           = patch.title.trim();
  if (patch.description     !== undefined) update.description     = patch.description?.trim() || null;
  if (patch.status          !== undefined) update.status          = sanitizeStatus(patch.status);
  if (patch.priority        !== undefined) update.priority        = sanitizePriority(patch.priority);
  if (patch.project_id      !== undefined) update.project_id      = patch.project_id || null;
  if (patch.assignee_id     !== undefined) update.assignee_id     = patch.assignee_id || null;
  if (patch.due_date        !== undefined) update.due_date        = patch.due_date || null;
  if (patch.start_date      !== undefined) update.start_date      = patch.start_date || null;
  if (patch.estimated_hours !== undefined) update.estimated_hours = patch.estimated_hours ?? null;
  if (patch.billable        !== undefined) update.billable        = patch.billable;
  if (patch.hourly_rate     !== undefined) update.hourly_rate     = patch.hourly_rate ?? null;

  const { error } = await supabase.from('tasks').update(update).eq('id', id);
  if (error) return { error: error.message };

  // Notify new assignee when assignee_id changed
  if (patch.assignee_id && patch.assignee_id !== user.id) {
    const [taskRes, profileRes, memberRes] = await Promise.all([
      supabase.from('tasks').select('title, project_id, workspace_id').eq('id', id).single(),
      supabase.from('profiles').select('full_name').eq('id', user.id).single(),
      supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).maybeSingle(),
    ]);
    const task        = taskRes.data;
    const workspaceId = task?.workspace_id ?? memberRes.data?.workspace_id;
    if (task && workspaceId) {
      const projectName = task.project_id
        ? (await supabase.from('projects').select('name').eq('id', task.project_id).single()).data?.name
        : undefined;
      notifyTaskAssigned({
        assigneeId:   patch.assignee_id,
        workspaceId,
        taskId:       id,
        taskTitle:    task.title,
        assignerName: profileRes.data?.full_name ?? 'Someone',
        projectName,
      }).catch(console.error);
    }
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  return { success: true };
}

// ── Move status (kanban drag) ─────────────────────────────────────────────────

export async function moveTaskStatus(id: string, status: TaskStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const update: Record<string, unknown> = { status };
  if (status === 'done') update.completed_at = new Date().toISOString();
  else update.completed_at = null;

  const { error } = await supabase.from('tasks').update(update).eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  return { success: true };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  return { success: true };
}

// ── Labels ────────────────────────────────────────────────────────────────────

export async function createLabel(name: string, color: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const wid = await getWorkspaceId(user.id);
  if (!wid) return { error: 'No workspace.' };

  const { data, error } = await supabase
    .from('task_labels')
    .insert({ workspace_id: wid, name: name.trim(), color, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath('/tasks');
  return { data };
}

export async function assignLabel(taskId: string, labelId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('task_label_assignments')
    .insert({ task_id: taskId, label_id: labelId });

  if (error && !error.message.includes('duplicate')) return { error: error.message };
  revalidatePath('/tasks');
  return { success: true };
}

export async function removeLabel(taskId: string, labelId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('task_label_assignments')
    .delete()
    .eq('task_id', taskId)
    .eq('label_id', labelId);

  if (error) return { error: error.message };
  revalidatePath('/tasks');
  return { success: true };
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(taskId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  if (!content.trim()) return { error: 'Comment cannot be empty.' };

  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, user_id: user.id, content: content.trim() })
    .select('*, profiles(full_name, avatar_url)')
    .single();

  if (error) return { error: error.message };

  // Notify task assignee / creator about new comment (fire-and-forget)
  const [taskRes, commenterRes, memberRes] = await Promise.all([
    supabase.from('tasks').select('title, assignee_id, created_by, workspace_id').eq('id', taskId).single(),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).maybeSingle(),
  ]);

  if (taskRes.data) {
    const task        = taskRes.data;
    const commenter   = commenterRes.data?.full_name ?? 'Someone';
    const workspaceId = task.workspace_id ?? memberRes.data?.workspace_id;
    const notifyUser  = task.assignee_id ?? task.created_by;

    if (notifyUser && notifyUser !== user.id && workspaceId) {
      notifyCommentAdded({
        taskOwnerId:   notifyUser,
        workspaceId,
        taskId,
        taskTitle:     task.title,
        commenterName: commenter,
        commentBody:   content.trim(),
      }).catch(console.error);
    }
  }

  return { data };
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('task_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  return { success: true };
}

// ── Subtasks ──────────────────────────────────────────────────────────────────

export async function createSubtask(parentId: string, title: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const wid = await getWorkspaceId(user.id);
  if (!wid) return { error: 'No workspace.' };

  // Inherit project from parent
  const { data: parent } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('id', parentId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id:   wid,
      created_by:     user.id,
      parent_task_id: parentId,
      project_id:     parent?.project_id ?? null,
      title:          title.trim(),
      status:         'todo',
      priority:       'medium',
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath('/tasks');
  return { data };
}

export async function updateSubtaskStatus(id: string, status: TaskStatus) {
  return moveTaskStatus(id, status);
}

// ── Sync label assignments for a task ────────────────────────────────────────

export async function syncTaskLabels(taskId: string, labelIds: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // Delete existing
  await supabase.from('task_label_assignments').delete().eq('task_id', taskId);

  // Insert new
  if (labelIds.length) {
    const { error } = await supabase
      .from('task_label_assignments')
      .insert(labelIds.map((lid) => ({ task_id: taskId, label_id: lid })));
    if (error) return { error: error.message };
  }

  revalidatePath('/tasks');
  return { success: true };
}
