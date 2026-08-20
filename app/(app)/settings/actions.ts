'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

// ── Profile ───────────────────────────────────────────────────────────────────

export async function updateProfile(data: {
  full_name?:  string;
  timezone?:   string;
  avatar_url?: string | null;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const patch: Record<string, unknown> = {};
  if (data.full_name  !== undefined) patch.fullName  = data.full_name.trim() || null;
  if (data.timezone   !== undefined) patch.timezone  = data.timezone;
  if (data.avatar_url !== undefined) patch.avatarUrl = data.avatar_url;

  try {
    await prisma.profile.update({
      where: { id: currentUser.profile.id },
      data:  patch,
    });

    if (data.avatar_url !== undefined) {
      await prisma.user.update({
        where: { id: currentUser.id },
        data:  { image: data.avatar_url },
      });
    }

    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    console.error('Error updating profile:', err);
    return { error: 'Failed to update profile.' };
  }
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export type WorkspaceSettings = {
  currency?:        string;
  hourly_rate?:     number | null;
  timezone?:        string;
  work_week_start?: 'monday' | 'sunday';
  date_format?:     string;
  time_format?:     '12h' | '24h';
};

export async function updateWorkspace(data: {
  name?:       string;
  avatar_url?: string | null;
  settings?:   WorkspaceSettings;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  if (!['owner', 'admin'].includes(currentUser.membership.role)) {
    return { error: 'Only owners and admins can update workspace settings.' };
  }

  const workspaceId = currentUser.workspace.id;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  const patch: Record<string, unknown> = {};
  if (data.name?.trim())       patch.name      = data.name.trim();
  if (data.avatar_url !== undefined) patch.avatarUrl = data.avatar_url;
  if (data.settings) {
    const existingSettings = (workspace?.settings as Record<string, unknown>) ?? {};
    patch.settings = { ...existingSettings, ...data.settings };
  }

  try {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data:  patch,
    });

    revalidatePath('/settings/workspace');
    return { success: true };
  } catch (err) {
    console.error('Error updating workspace:', err);
    return { error: 'Failed to update workspace.' };
  }
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationPrefs = {
  task_assigned:   boolean;
  task_due:        boolean;
  project_updates: boolean;
  billing:         boolean;
  weekly_summary:  boolean;
};

export async function updateNotificationPrefs(prefs: NotificationPrefs) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const workspaceId = currentUser.workspace.id;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  const current   = (workspace?.settings ?? {}) as Record<string, unknown>;
  const userPrefs = (current.user_prefs   ?? {}) as Record<string, unknown>;
  const userEntry = (userPrefs[currentUser.profile.id] ?? {}) as Record<string, unknown>;

  try {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...current,
          user_prefs: {
            ...userPrefs,
            [currentUser.profile.id]: { ...userEntry, notifications: prefs },
          },
        } as any,
      },
    });

    return { success: true };
  } catch (err) {
    console.error('Error updating notification preferences:', err);
    return { error: 'Failed to update notification preferences.' };
  }
}

// ── Time Tracking ─────────────────────────────────────────────────────────────

export type TimeTrackingSettings = {
  default_billable?:  boolean;
  rounding_minutes?:  0 | 5 | 10 | 15 | 30;
  hours_per_day?:     number;
  idle_timeout_mins?: number;
};

export async function updateTimeTrackingSettings(settings: TimeTrackingSettings) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const workspaceId = currentUser.workspace.id;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  const current = (workspace?.settings ?? {}) as Record<string, unknown>;
  const existing = (current.time_tracking ?? {}) as Record<string, unknown>;

  try {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: { ...current, time_tracking: { ...existing, ...settings } },
      },
    });

    revalidatePath('/settings/time-tracking');
    return { success: true };
  } catch (err) {
    console.error('Error updating time tracking settings:', err);
    return { error: 'Failed to update time tracking settings.' };
  }
}

// ── Security ──────────────────────────────────────────────────────────────────

export async function changePassword({
  currentPassword,
  newPassword,
}: {
  currentPassword: string;
  newPassword:     string;
}) {
  if (newPassword.length < 8) return { error: 'New password must be at least 8 characters.' };

  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
  });

  if (!user?.passwordHash) {
    return { error: 'This account uses social sign-in. Password change is not supported.' };
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { error: 'Current password is incorrect.' };

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: currentUser.id },
    data:  { passwordHash: newHash },
  });

  return { success: true };
}

export async function signOutAllSessions() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.session.deleteMany({
      where: { userId: currentUser.id },
    });
    return { success: true };
  } catch (err) {
    console.error('Error signing out sessions:', err);
    return { error: 'Failed to sign out all sessions.' };
  }
}
