import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NotificationsClient } from './_components/NotificationsClient';
import type { NotificationPrefs } from '../actions';

export const metadata: Metadata = { title: 'Notification Settings' };

const DEFAULT_PREFS: NotificationPrefs = {
  task_assigned:   true,
  task_due:        true,
  project_updates: false,
  billing:         true,
  weekly_summary:  true,
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let prefs = { ...DEFAULT_PREFS };

  if (member?.workspace_id) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', member.workspace_id)
      .single();

    const settings    = (workspace?.settings ?? {}) as Record<string, unknown>;
    const userPrefs   = (settings.user_prefs  ?? {}) as Record<string, unknown>;
    const userEntry   = (userPrefs[user.id]   ?? {}) as Record<string, unknown>;
    const saved       = userEntry.notifications as Partial<NotificationPrefs> | undefined;

    if (saved) {
      prefs = {
        task_assigned:   saved.task_assigned   ?? DEFAULT_PREFS.task_assigned,
        task_due:        saved.task_due        ?? DEFAULT_PREFS.task_due,
        project_updates: saved.project_updates ?? DEFAULT_PREFS.project_updates,
        billing:         saved.billing         ?? DEFAULT_PREFS.billing,
        weekly_summary:  saved.weekly_summary  ?? DEFAULT_PREFS.weekly_summary,
      };
    }
  }

  return <NotificationsClient initialPrefs={prefs} />;
}
