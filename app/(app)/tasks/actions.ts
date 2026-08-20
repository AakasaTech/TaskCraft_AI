'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
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
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const wid = currentUser.workspace.id;
  const uid = currentUser.profile.id;

  try {
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          workspaceId:    wid,
          createdById:    uid,
          title:          input.title.trim(),
          description:    input.description?.trim() || null,
          status:         sanitizeStatus(input.status ?? 'todo'),
          priority:       sanitizePriority(input.priority ?? 'medium'),
          projectId:      input.project_id || null,
          assigneeId:     input.assignee_id || null,
          dueDate:        input.due_date ? new Date(input.due_date) : null,
          startDate:      input.start_date ? new Date(input.start_date) : null,
          estimatedHours: input.estimated_hours ?? null,
          billable:       input.billable ?? false,
          hourlyRate:     input.hourly_rate ?? null,
          parentTaskId:   input.parent_task_id || null,
        },
      });

      if (input.label_ids?.length) {
        await tx.taskLabelAssignment.createMany({
          data: input.label_ids.map((lid) => ({
            taskId:  created.id,
            labelId: lid,
          })),
        });
      }

      await tx.taskActivity.create({
        data: {
          taskId: created.id,
          userId: uid,
          action: 'created',
        },
      });

      return created;
    });

    // Notify assignee if different from creator
    if (input.assignee_id && input.assignee_id !== uid) {
      const project = input.project_id
        ? await prisma.project.findUnique({ where: { id: input.project_id }, select: { name: true } })
        : null;

      notifyTaskAssigned({
        assigneeId:   input.assignee_id,
        workspaceId:  wid,
        taskId:       task.id,
        taskTitle:    task.title,
        assignerName: currentUser.profile.fullName || 'Someone',
        projectName:  project?.name ?? undefined,
      }).catch(console.error);
    }

    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { data: task };
  } catch (err) {
    console.error('Error creating task:', err);
    return { error: 'Failed to create task.' };
  }
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
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const data: Record<string, unknown> = {};
  if (patch.title           !== undefined) data.title          = patch.title.trim();
  if (patch.description     !== undefined) data.description    = patch.description?.trim() || null;
  if (patch.status          !== undefined) {
    data.status = sanitizeStatus(patch.status);
    if (patch.status === 'done') data.completedAt = new Date();
    else data.completedAt = null;
  }
  if (patch.priority        !== undefined) data.priority       = sanitizePriority(patch.priority);
  if (patch.project_id      !== undefined) data.projectId      = patch.project_id || null;
  if (patch.assignee_id     !== undefined) data.assigneeId     = patch.assignee_id || null;
  if (patch.due_date        !== undefined) data.dueDate        = patch.due_date ? new Date(patch.due_date) : null;
  if (patch.start_date      !== undefined) data.startDate      = patch.start_date ? new Date(patch.start_date) : null;
  if (patch.estimated_hours !== undefined) data.estimatedHours = patch.estimated_hours ?? null;
  if (patch.billable        !== undefined) data.billable       = patch.billable;
  if (patch.hourly_rate     !== undefined) data.hourlyRate    = patch.hourly_rate ?? null;

  try {
    const updated = await prisma.task.update({
      where: { id },
      data,
      include: { project: { select: { name: true } } },
    });

    // Notify new assignee if changed
    if (patch.assignee_id && patch.assignee_id !== currentUser.profile.id) {
      notifyTaskAssigned({
        assigneeId:   patch.assignee_id,
        workspaceId:  updated.workspaceId,
        taskId:       id,
        taskTitle:    updated.title,
        assignerName: currentUser.profile.fullName || 'Someone',
        projectName:  updated.project?.name ?? undefined,
      }).catch(console.error);
    }

    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    console.error('Error updating task:', err);
    return { error: 'Failed to update task.' };
  }
}

// ── Move status (kanban drag) ─────────────────────────────────────────────────

export async function moveTaskStatus(id: string, status: TaskStatus) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.task.update({
      where: { id },
      data: {
        status: sanitizeStatus(status),
        completedAt: status === 'done' ? new Date() : null,
      },
    });

    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    console.error('Error moving task status:', err);
    return { error: 'Failed to update task status.' };
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteTask(id: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.task.delete({
      where: { id },
    });

    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    console.error('Error deleting task:', err);
    return { error: 'Failed to delete task.' };
  }
}

// ── Labels ────────────────────────────────────────────────────────────────────

export async function createLabel(name: string, color: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    const label = await prisma.taskLabel.create({
      data: {
        workspaceId: currentUser.workspace.id,
        name:        name.trim(),
        color,
        createdById: currentUser.profile.id,
      },
    });

    revalidatePath('/tasks');
    return { data: label };
  } catch (err) {
    console.error('Error creating label:', err);
    return { error: 'Failed to create label.' };
  }
}

export async function assignLabel(taskId: string, labelId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.taskLabelAssignment.upsert({
      where: {
        taskId_labelId: { taskId, labelId },
      },
      update: {},
      create: { taskId, labelId },
    });

    revalidatePath('/tasks');
    return { success: true };
  } catch (err) {
    console.error('Error assigning label:', err);
    return { error: 'Failed to assign label.' };
  }
}

export async function removeLabel(taskId: string, labelId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.taskLabelAssignment.deleteMany({
      where: { taskId, labelId },
    });

    revalidatePath('/tasks');
    return { success: true };
  } catch (err) {
    console.error('Error removing label:', err);
    return { error: 'Failed to remove label.' };
  }
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function addComment(taskId: string, content: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  if (!content.trim()) return { error: 'Comment cannot be empty.' };

  try {
    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId:  currentUser.profile.id,
        content: content.trim(),
      },
      include: {
        user: { select: { fullName: true, avatarUrl: true } },
      },
    });

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true, assigneeId: true, createdById: true, workspaceId: true },
    });

    if (task) {
      const notifyUser = task.assigneeId ?? task.createdById;
      if (notifyUser && notifyUser !== currentUser.profile.id) {
        notifyCommentAdded({
          taskOwnerId:   notifyUser,
          workspaceId:   task.workspaceId,
          taskId,
          taskTitle:     task.title,
          commenterName: currentUser.profile.fullName || 'Someone',
          commentBody:   content.trim(),
        }).catch(console.error);
      }
    }

    return { data: comment };
  } catch (err) {
    console.error('Error adding comment:', err);
    return { error: 'Failed to add comment.' };
  }
}

export async function deleteComment(commentId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.taskComment.deleteMany({
      where: {
        id:     commentId,
        userId: currentUser.profile.id,
      },
    });

    return { success: true };
  } catch (err) {
    console.error('Error deleting comment:', err);
    return { error: 'Failed to delete comment.' };
  }
}

// ── Subtasks ──────────────────────────────────────────────────────────────────

export async function createSubtask(parentId: string, title: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    const parent = await prisma.task.findUnique({
      where: { id: parentId },
      select: { projectId: true },
    });

    const subtask = await prisma.task.create({
      data: {
        workspaceId:  currentUser.workspace.id,
        createdById:  currentUser.profile.id,
        parentTaskId: parentId,
        projectId:    parent?.projectId ?? null,
        title:        title.trim(),
        status:       'todo',
        priority:     'medium',
      },
    });

    revalidatePath('/tasks');
    return { data: subtask };
  } catch (err) {
    console.error('Error creating subtask:', err);
    return { error: 'Failed to create subtask.' };
  }
}

export async function updateSubtaskStatus(id: string, status: TaskStatus) {
  return moveTaskStatus(id, status);
}

// ── Sync label assignments for a task ────────────────────────────────────────

export async function syncTaskLabels(taskId: string, labelIds: string[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.$transaction([
      prisma.taskLabelAssignment.deleteMany({ where: { taskId } }),
      ...(labelIds.length > 0
        ? [
            prisma.taskLabelAssignment.createMany({
              data: labelIds.map((labelId) => ({ taskId, labelId })),
            }),
          ]
        : []),
    ]);

    revalidatePath('/tasks');
    return { success: true };
  } catch (err) {
    console.error('Error syncing task labels:', err);
    return { error: 'Failed to sync task labels.' };
  }
}
