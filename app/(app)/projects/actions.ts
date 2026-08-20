'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import type { ProjectStatus, ProjectMemberRole, Plan } from '@/lib/types';
import { PLANS } from '@/lib/constants';
import { getEffectivePlan } from '@/lib/plan-gates';

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

// ── Create ────────────────────────────────────────────────────────────────────

export async function createProject(input: ProjectInput) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  if (!input.name?.trim()) return { error: 'Project name is required.' };

  const workspaceId = currentUser.workspace.id;
  const uid = currentUser.profile.id;

  // Enforce plan project limit
  const planKey = getEffectivePlan(
    currentUser.profile.plan as Plan,
    currentUser.profile.planExpiresAt?.toISOString() ?? null
  ) as keyof typeof PLANS;
  const limit: number = PLANS[planKey]?.max_projects ?? 3;

  if (limit !== -1) {
    const activeCount = await prisma.project.count({
      where: {
        workspaceId,
        status: { not: 'archived' },
      },
    });

    if (activeCount >= limit) {
      return {
        error: `Your ${PLANS[planKey].name} plan allows up to ${limit} active project${limit !== 1 ? 's' : ''}. Archive a project or upgrade your plan to create more.`,
        limitReached: true,
      };
    }
  }

  try {
    const project = await prisma.project.create({
      data: {
        workspaceId,
        createdById: uid,
        name:        input.name.trim(),
        description: input.description?.trim() || null,
        color:       input.color,
        status:      input.status,
        clientId:    input.client_id || null,
        startDate:   input.start_date ? new Date(input.start_date) : null,
        dueDate:     input.due_date ? new Date(input.due_date) : null,
        budget:      input.budget ?? null,
        hourlyRate:  input.hourly_rate ?? null,
        billable:    input.billable,
      },
    });

    revalidatePath('/projects');
    return { data: project };
  } catch (err) {
    console.error('Error creating project:', err);
    return { error: 'Failed to create project.' };
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateProject(id: string, input: Partial<ProjectInput>) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const data: Record<string, unknown> = {};
  if (input.name         !== undefined) data.name        = input.name.trim();
  if (input.description  !== undefined) data.description = input.description?.trim() || null;
  if (input.color        !== undefined) data.color       = input.color;
  if (input.status       !== undefined) data.status      = input.status;
  if (input.client_id    !== undefined) data.clientId    = input.client_id || null;
  if (input.start_date   !== undefined) data.startDate   = input.start_date ? new Date(input.start_date) : null;
  if (input.due_date     !== undefined) data.dueDate     = input.due_date ? new Date(input.due_date) : null;
  if (input.budget       !== undefined) data.budget      = input.budget ?? null;
  if (input.hourly_rate  !== undefined) data.hourlyRate  = input.hourly_rate ?? null;
  if (input.billable     !== undefined) data.billable    = input.billable;

  try {
    const project = await prisma.project.update({
      where: { id },
      data,
    });

    revalidatePath('/projects');
    revalidatePath(`/projects/${id}`);
    return { data: project };
  } catch (err) {
    console.error('Error updating project:', err);
    return { error: 'Failed to update project.' };
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteProject(id: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.project.delete({
      where: { id },
    });

    revalidatePath('/projects');
    return { success: true };
  } catch (err) {
    console.error('Error deleting project:', err);
    return { error: 'Failed to delete project.' };
  }
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
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { data: member };
  } catch (err) {
    console.error('Error adding project member:', err);
    return { error: 'Failed to add project member.' };
  }
}

export async function removeProjectMember(projectId: string, userId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.projectMember.deleteMany({
      where: {
        projectId,
        userId,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error('Error removing project member:', err);
    return { error: 'Failed to remove project member.' };
  }
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.projectMember.updateMany({
      where: {
        projectId,
        userId,
      },
      data: { role },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error('Error updating project member role:', err);
    return { error: 'Failed to update member role.' };
  }
}
