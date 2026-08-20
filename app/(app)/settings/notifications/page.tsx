import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
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
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const settings  = (currentUser.workspace.settings ?? {}) as Record<string, unknown>;
  const userPrefs = (settings.user_prefs ?? {}) as Record<string, unknown>;
  const userEntry = (userPrefs[currentUser.profile.id] ?? {}) as Record<string, unknown>;
  const saved     = userEntry.notifications as Partial<NotificationPrefs> | undefined;

  const prefs: NotificationPrefs = saved
    ? {
        task_assigned:   saved.task_assigned   ?? DEFAULT_PREFS.task_assigned,
        task_due:        saved.task_due        ?? DEFAULT_PREFS.task_due,
        project_updates: saved.project_updates ?? DEFAULT_PREFS.project_updates,
        billing:         saved.billing         ?? DEFAULT_PREFS.billing,
        weekly_summary:  saved.weekly_summary  ?? DEFAULT_PREFS.weekly_summary,
      }
    : { ...DEFAULT_PREFS };

  return <NotificationsClient initialPrefs={prefs} />;
}
