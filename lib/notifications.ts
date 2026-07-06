import { createAdminClient } from '@/lib/supabase/admin';
import type { NotificationType } from '@/lib/types';

// ── Core create utility ───────────────────────────────────────────────────────

export async function createNotification(params: {
  userId:       string;
  workspaceId?: string;
  type:         NotificationType;
  title:        string;
  body?:        string;
  link?:        string;
  metadata?:    Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from('notifications').insert({
    user_id:      params.userId,
    workspace_id: params.workspaceId ?? null,
    type:         params.type,
    title:        params.title,
    body:         params.body    ?? null,
    link:         params.link    ?? null,
    metadata:     params.metadata ?? {},
  });

  if (error) {
    console.error('[notifications] create error:', error.message);
  }
}

// Helper: avoid duplicate notifications for the same event within a window
async function notificationExists(userId: string, type: NotificationType, dedupeKey: string) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('metadata->>dedupe_key', dedupeKey)
    .gte('created_at', since)
    .maybeSingle();
  return !!data;
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

export async function notifyTaskAssigned(params: {
  assigneeId:   string;
  assigneeEmail?: string;
  workspaceId:  string;
  taskId:       string;
  taskTitle:    string;
  assignerName: string;
  projectName?: string;
}) {
  await createNotification({
    userId:      params.assigneeId,
    workspaceId: params.workspaceId,
    type:        'task_assigned',
    title:       `Task assigned: "${params.taskTitle}"`,
    body:        `${params.assignerName} assigned this task to you${params.projectName ? ` in ${params.projectName}` : ''}.`,
    link:        `/tasks?task=${params.taskId}`,
    metadata:    { task_id: params.taskId, assigner_name: params.assignerName, dedupe_key: params.taskId },
  });
}

export async function notifyCommentAdded(params: {
  taskOwnerId:   string;
  workspaceId:   string;
  taskId:        string;
  taskTitle:     string;
  commenterName: string;
  commentBody:   string;
}) {
  if (params.taskOwnerId === params.commenterName) return; // don't notify self (rough check, fine for now)

  const dedupeKey = `${params.taskId}_${Date.now()}`;
  await createNotification({
    userId:      params.taskOwnerId,
    workspaceId: params.workspaceId,
    type:        'comment_added',
    title:       `Comment on "${params.taskTitle}"`,
    body:        `${params.commenterName}: ${params.commentBody.slice(0, 120)}${params.commentBody.length > 120 ? '…' : ''}`,
    link:        `/tasks?task=${params.taskId}`,
    metadata:    { task_id: params.taskId, commenter_name: params.commenterName, dedupe_key: dedupeKey },
  });
}

export async function notifyTaskDueSoon(params: {
  userId:      string;
  workspaceId: string;
  taskId:      string;
  taskTitle:   string;
  dueDate:     string;
}) {
  const exists = await notificationExists(params.userId, 'task_due_soon', params.taskId);
  if (exists) return;

  const due = new Date(params.dueDate);
  const hrs = Math.round((due.getTime() - Date.now()) / 3_600_000);

  await createNotification({
    userId:      params.userId,
    workspaceId: params.workspaceId,
    type:        'task_due_soon',
    title:       `Task due soon: "${params.taskTitle}"`,
    body:        `Due in ${hrs < 2 ? 'less than 2 hours' : `~${hrs} hours`}.`,
    link:        `/tasks?task=${params.taskId}`,
    metadata:    { task_id: params.taskId, due_date: params.dueDate, dedupe_key: params.taskId },
  });
}

export async function notifyTaskOverdue(params: {
  userId:      string;
  workspaceId: string;
  taskId:      string;
  taskTitle:   string;
  dueDate:     string;
}) {
  const exists = await notificationExists(params.userId, 'task_overdue', params.taskId);
  if (exists) return;

  const days = Math.floor((Date.now() - new Date(params.dueDate).getTime()) / 86_400_000);

  await createNotification({
    userId:      params.userId,
    workspaceId: params.workspaceId,
    type:        'task_overdue',
    title:       `Overdue: "${params.taskTitle}"`,
    body:        `This task is ${days === 0 ? 'due today' : `${days} day${days !== 1 ? 's' : ''} overdue`}.`,
    link:        `/tasks?task=${params.taskId}`,
    metadata:    { task_id: params.taskId, due_date: params.dueDate, days_overdue: days, dedupe_key: params.taskId },
  });
}

export async function notifyProjectDeadlineNear(params: {
  userId:       string;
  workspaceId:  string;
  projectId:    string;
  projectName:  string;
  dueDate:      string;
}) {
  const exists = await notificationExists(params.userId, 'project_deadline_near', params.projectId);
  if (exists) return;

  const days = Math.floor((new Date(params.dueDate).getTime() - Date.now()) / 86_400_000);

  await createNotification({
    userId:      params.userId,
    workspaceId: params.workspaceId,
    type:        'project_deadline_near',
    title:       `Project deadline: "${params.projectName}"`,
    body:        `Deadline in ${days} day${days !== 1 ? 's' : ''}.`,
    link:        `/projects/${params.projectId}`,
    metadata:    { project_id: params.projectId, due_date: params.dueDate, dedupe_key: params.projectId },
  });
}

export async function notifyTimerRunningLong(params: {
  userId:      string;
  workspaceId: string;
  entryId:     string;
  description: string;
  hours:       number;
}) {
  const dedupeKey = `${params.entryId}_long`;
  const exists = await notificationExists(params.userId, 'timer_running_long', dedupeKey);
  if (exists) return;

  await createNotification({
    userId:      params.userId,
    workspaceId: params.workspaceId,
    type:        'timer_running_long',
    title:       'Timer still running',
    body:        `"${params.description || 'Timer'}" has been running for ${params.hours} hours. Don't forget to stop it.`,
    link:        '/time',
    metadata:    { entry_id: params.entryId, hours: params.hours, dedupe_key: dedupeKey },
  });
}

export async function notifyInvoiceSyncCompleted(params: {
  userId:       string;
  workspaceId:  string;
  invoiceCount: number;
  totalAmount:  number;
  currency:     string;
}) {
  await createNotification({
    userId:      params.userId,
    workspaceId: params.workspaceId,
    type:        'invoice_sync_completed',
    title:       `Invoice sync complete`,
    body:        `${params.invoiceCount} invoice${params.invoiceCount !== 1 ? 's' : ''} sent to BillCraft AI (${params.currency} ${params.totalAmount.toFixed(2)}).`,
    link:        '/integrations',
    metadata:    { invoice_count: params.invoiceCount, total_amount: params.totalAmount },
  });
}

export async function notifySupportTicketTaskCreated(params: {
  userId:      string;
  workspaceId: string;
  taskId:      string;
  taskTitle:   string;
  ticketTitle: string;
}) {
  await createNotification({
    userId:      params.userId,
    workspaceId: params.workspaceId,
    type:        'support_ticket_task_created',
    title:       `Task created from support ticket`,
    body:        `"${params.taskTitle}" was created from ticket: "${params.ticketTitle}".`,
    link:        `/tasks?task=${params.taskId}`,
    metadata:    { task_id: params.taskId, ticket_title: params.ticketTitle },
  });
}

export async function notifyTeamInvitationReceived(params: {
  userId:        string;
  workspaceId:   string;
  workspaceName: string;
  inviterName:   string;
}) {
  await createNotification({
    userId:      params.userId,
    workspaceId: params.workspaceId,
    type:        'team_invitation_received',
    title:       `You've been invited to "${params.workspaceName}"`,
    body:        `${params.inviterName} invited you to join their workspace.`,
    link:        '/dashboard',
    metadata:    { workspace_name: params.workspaceName, inviter_name: params.inviterName },
  });
}

// ── Due-check batch (called by cron) ─────────────────────────────────────────

export async function runDueNotifications(workspaceId: string) {
  const admin = createAdminClient();

  const now      = new Date();
  const in24h    = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const nowIso   = now.toISOString();

  // Tasks due in ≤ 24h (not done)
  const { data: dueSoon } = await admin
    .from('tasks')
    .select('id, title, due_date, assignee_id')
    .eq('workspace_id', workspaceId)
    .not('assignee_id', 'is', null)
    .neq('status', 'done')
    .gte('due_date', nowIso)
    .lte('due_date', in24h);

  for (const task of (dueSoon ?? [])) {
    if (!task.assignee_id) continue;
    await notifyTaskDueSoon({
      userId:      task.assignee_id,
      workspaceId,
      taskId:      task.id,
      taskTitle:   task.title,
      dueDate:     task.due_date,
    });
  }

  // Overdue tasks (not done)
  const { data: overdue } = await admin
    .from('tasks')
    .select('id, title, due_date, assignee_id')
    .eq('workspace_id', workspaceId)
    .not('assignee_id', 'is', null)
    .neq('status', 'done')
    .lt('due_date', nowIso);

  for (const task of (overdue ?? [])) {
    if (!task.assignee_id) continue;
    await notifyTaskOverdue({
      userId:      task.assignee_id,
      workspaceId,
      taskId:      task.id,
      taskTitle:   task.title,
      dueDate:     task.due_date,
    });
  }

  return {
    dueSoonCount: (dueSoon ?? []).length,
    overdueCount: (overdue ?? []).length,
  };
}
