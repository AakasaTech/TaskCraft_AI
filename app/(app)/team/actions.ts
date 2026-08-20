'use server';

import { redirect } from 'next/navigation';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';

// ── Helpers ───────────────────────────────────────────────────────────────────

function canManage(role: string) { return role === 'owner' || role === 'admin'; }

// ── Invite member ─────────────────────────────────────────────────────────────

export async function inviteMember(email: string, role: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  if (!canManage(currentUser.membership.role)) return { error: 'Insufficient permissions' };

  const workspaceId = currentUser.workspace.id;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if email is already a member
  const profile = await prisma.profile.findFirst({
    where: { email: normalizedEmail },
  });

  if (profile) {
    const existing = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: profile.id,
        },
      },
    });
    if (existing) return { error: 'This user is already a workspace member' };
  }

  // Check for pending invite
  const pending = await prisma.workspaceInvitation.findFirst({
    where: {
      workspaceId,
      email: normalizedEmail,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (pending) return { error: 'An invitation is already pending for this email' };

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  try {
    await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email:       normalizedEmail,
        role,
        token,
        invitedById: currentUser.profile.id,
        expiresAt,
      },
    });

    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    revalidatePath('/team');
    return { data: { inviteUrl: `${base}/team/invite?token=${token}` } };
  } catch (err) {
    console.error('Error inviting member:', err);
    return { error: 'Failed to create invitation' };
  }
}

// ── Cancel invitation ─────────────────────────────────────────────────────────

export async function cancelInvitation(id: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  if (!canManage(currentUser.membership.role)) return { error: 'Insufficient permissions' };

  try {
    await prisma.workspaceInvitation.deleteMany({
      where: {
        id,
        workspaceId: currentUser.workspace.id,
      },
    });

    revalidatePath('/team');
    return { data: { ok: true } };
  } catch (err) {
    console.error('Error cancelling invitation:', err);
    return { error: 'Failed to cancel invitation' };
  }
}

// ── Remove member ─────────────────────────────────────────────────────────────

export async function removeMember(memberId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  if (!canManage(currentUser.membership.role)) return { error: 'Insufficient permissions' };

  const workspaceId = currentUser.workspace.id;

  const target = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
  });

  if (!target) return { error: 'Member not found' };
  if (target.userId === currentUser.profile.id) return { error: 'You cannot remove yourself' };
  if (target.role === 'owner') return { error: 'Cannot remove the workspace owner' };
  if (target.role === 'admin' && currentUser.membership.role !== 'owner') {
    return { error: 'Only the owner can remove admins' };
  }

  try {
    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });

    revalidatePath('/team');
    return { data: { ok: true } };
  } catch (err) {
    console.error('Error removing member:', err);
    return { error: 'Failed to remove member' };
  }
}

// ── Change member role ────────────────────────────────────────────────────────

export async function changeMemberRole(memberId: string, newRole: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  if (!canManage(currentUser.membership.role)) return { error: 'Insufficient permissions' };

  const workspaceId = currentUser.workspace.id;

  const target = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId },
  });

  if (!target) return { error: 'Member not found' };
  if (target.userId === currentUser.profile.id) return { error: 'You cannot change your own role' };
  if (target.role === 'owner') return { error: "Cannot change the owner's role" };
  if (target.role === 'admin' && currentUser.membership.role !== 'owner') {
    return { error: 'Only the owner can change admin roles' };
  }
  if (newRole === 'owner') return { error: 'Cannot assign the owner role' };

  try {
    await prisma.workspaceMember.update({
      where: { id: memberId },
      data:  { role: newRole },
    });

    revalidatePath('/team');
    return { data: { ok: true } };
  } catch (err) {
    console.error('Error updating role:', err);
    return { error: 'Failed to update role' };
  }
}

// ── Accept invitation ─────────────────────────────────────────────────────────

export async function acceptInvitation(token: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Must be logged in to accept invitation' };

  const invite = await prisma.workspaceInvitation.findFirst({
    where: {
      token,
      acceptedAt: null,
      expiresAt:  { gt: new Date() },
    },
  });

  if (!invite) return { error: 'This invitation is invalid or has expired' };

  // Already a member?
  const existing = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: invite.workspaceId,
        userId:      currentUser.profile.id,
      },
    },
  });

  if (existing) {
    await prisma.workspaceInvitation.update({
      where: { id: invite.id },
      data:  { acceptedAt: new Date() },
    });
    return { data: { workspaceId: invite.workspaceId, alreadyMember: true } };
  }

  try {
    await prisma.$transaction([
      prisma.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId:      currentUser.profile.id,
          role:        invite.role,
          invitedBy:   invite.invitedById,
          invitedAt:   invite.createdAt,
          joinedAt:    new Date(),
        },
      }),
      prisma.workspaceInvitation.update({
        where: { id: invite.id },
        data:  { acceptedAt: new Date() },
      }),
    ]);

    return { data: { workspaceId: invite.workspaceId } };
  } catch (err) {
    console.error('Error accepting invitation:', err);
    return { error: 'Failed to join workspace' };
  }
}

// ── Workload data ─────────────────────────────────────────────────────────────

export interface WorkloadMember {
  user_id:        string;
  full_name:      string | null;
  avatar_url:     string | null;
  email:          string;
  role:           string;
  taskCounts:     Record<string, number>;
  totalTasks:     number;
  hoursThisMonth: number;
}

export async function getWorkloadData(): Promise<{ data?: WorkloadMember[]; error?: string }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const workspaceId = currentUser.workspace.id;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [membersRes, tasksRes, timeRes] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { fullName: true, avatarUrl: true, email: true } },
      },
    }),
    prisma.task.findMany({
      where: { workspaceId, assigneeId: { not: null } },
      select: { assigneeId: true, status: true },
    }),
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        startTime: { gte: monthStart },
        durationMinutes: { not: null },
      },
      select: { userId: true, durationMinutes: true },
    }),
  ]);

  const tasksByUser: Record<string, Record<string, number>> = {};
  for (const t of tasksRes) {
    if (!t.assigneeId) continue;
    tasksByUser[t.assigneeId] ??= {};
    tasksByUser[t.assigneeId][t.status] = (tasksByUser[t.assigneeId][t.status] ?? 0) + 1;
  }

  const hoursByUser: Record<string, number> = {};
  for (const e of timeRes) {
    hoursByUser[e.userId] = (hoursByUser[e.userId] ?? 0) + (e.durationMinutes ?? 0) / 60;
  }

  const data: WorkloadMember[] = membersRes.map((m) => {
    const counts = tasksByUser[m.userId] ?? {};
    return {
      user_id:        m.userId,
      full_name:      m.user.fullName,
      avatar_url:     m.user.avatarUrl,
      email:          m.user.email,
      role:           m.role,
      taskCounts:     counts,
      totalTasks:     Object.values(counts).reduce((a, b) => a + b, 0),
      hoursThisMonth: Math.round((hoursByUser[m.userId] ?? 0) * 10) / 10,
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
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const workspaceId = currentUser.workspace.id;

  const [membersRes, entriesRes] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { fullName: true, avatarUrl: true } },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        workspaceId,
        startTime: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo + 'T23:59:59.999Z'),
        },
        durationMinutes: { not: null },
      },
      include: {
        project: { select: { name: true, color: true } },
        task:    { select: { title: true } },
      },
      orderBy: { startTime: 'desc' },
    }),
  ]);

  const byUser: Record<string, typeof entriesRes> = {};
  for (const e of entriesRes) {
    byUser[e.userId] ??= [];
    byUser[e.userId].push(e);
  }

  const data: TimesheetRow[] = membersRes
    .filter((m) => (byUser[m.userId]?.length ?? 0) > 0)
    .map((m) => {
      const entries = (byUser[m.userId] ?? []).map((e) => ({
        id:               e.id,
        description:      e.description,
        start_time:       e.startTime.toISOString(),
        duration_minutes: e.durationMinutes ?? 0,
        billable:         e.billable,
        project_name:     e.project?.name ?? null,
        project_color:    e.project?.color ?? null,
        task_title:       e.task?.title ?? null,
      }));
      const totalMinutes    = entries.reduce((s, x) => s + x.duration_minutes, 0);
      const billableMinutes = entries.filter((x) => x.billable).reduce((s, x) => s + x.duration_minutes, 0);
      return {
        user_id:         m.userId,
        full_name:       m.user.fullName,
        avatar_url:      m.user.avatarUrl,
        entries,
        totalMinutes,
        billableMinutes,
      };
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
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const workspaceId = currentUser.workspace.id;

  const where: any = {
    task: { workspaceId },
  };

  if (memberId) {
    where.userId = memberId;
  }

  const activities = await prisma.taskActivity.findMany({
    where,
    include: {
      task: { select: { title: true } },
      user: { select: { fullName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const data: ActivityEntry[] = activities.map((a) => ({
    id:         a.id,
    task_id:    a.taskId,
    task_title: a.task.title,
    user_id:    a.userId,
    full_name:  a.user?.fullName ?? null,
    avatar_url: a.user?.avatarUrl ?? null,
    action:     a.action,
    old_value:  a.oldValue,
    new_value:  a.newValue,
    created_at: a.createdAt.toISOString(),
  }));

  return { data };
}
