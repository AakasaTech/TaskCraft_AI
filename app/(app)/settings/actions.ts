'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// ── Profile ───────────────────────────────────────────────────────────────────

export async function updateProfile(data: {
  full_name?:  string;
  timezone?:   string;
  avatar_url?: string | null;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.full_name  !== undefined) patch.full_name  = data.full_name.trim() || null;
  if (data.timezone   !== undefined) patch.timezone   = data.timezone;
  if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;

  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { success: true };
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member)                                    return { error: 'Not a workspace member.' };
  if (!['owner', 'admin'].includes(member.role))  return { error: 'Only owners and admins can update workspace settings.' };

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', member.workspace_id)
    .single();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name?.trim())       patch.name       = data.name.trim();
  if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
  if (data.settings) {
    patch.settings = { ...(workspace?.settings ?? {}), ...data.settings };
  }

  const { error } = await supabase
    .from('workspaces')
    .update(patch)
    .eq('id', member.workspace_id);

  if (error) return { error: error.message };

  revalidatePath('/settings/workspace');
  return { success: true };
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) return { error: 'No workspace found.' };

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', member.workspace_id)
    .single();

  const current   = (workspace?.settings ?? {}) as Record<string, unknown>;
  const userPrefs = (current.user_prefs   ?? {}) as Record<string, unknown>;
  const userEntry = (userPrefs[user.id]   ?? {}) as Record<string, unknown>;

  const { error } = await supabase
    .from('workspaces')
    .update({
      settings: {
        ...current,
        user_prefs: {
          ...userPrefs,
          [user.id]: { ...userEntry, notifications: prefs },
        },
      },
    })
    .eq('id', member.workspace_id);

  if (error) return { error: error.message };
  return { success: true };
}

// ── Time Tracking ─────────────────────────────────────────────────────────────

export type TimeTrackingSettings = {
  default_billable?:  boolean;
  rounding_minutes?:  0 | 5 | 10 | 15 | 30;
  hours_per_day?:     number;
  idle_timeout_mins?: number;
};

export async function updateTimeTrackingSettings(settings: TimeTrackingSettings) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member) return { error: 'No workspace found.' };

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', member.workspace_id)
    .single();

  const current = (workspace?.settings ?? {}) as Record<string, unknown>;
  const existing = (current.time_tracking ?? {}) as Record<string, unknown>;

  const { error } = await supabase
    .from('workspaces')
    .update({
      settings: { ...current, time_tracking: { ...existing, ...settings } },
    })
    .eq('id', member.workspace_id);

  if (error) return { error: error.message };

  revalidatePath('/settings/time-tracking');
  return { success: true };
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Unauthorized' };

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email:    user.email,
    password: currentPassword,
  });
  if (signInError) return { error: 'Current password is incorrect.' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { success: true };
}

export async function signOutAllSessions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) return { error: error.message };

  return { success: true };
}
