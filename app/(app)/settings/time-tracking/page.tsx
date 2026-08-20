import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { PageHeader } from '@/components/shared/PageHeader';
import { TimeTrackingClient } from './_components/TimeTrackingClient';
import type { TimeTrackingSettings } from '../actions';

export const metadata: Metadata = { title: 'Time Tracking Settings' };

export default async function TimeTrackingSettingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const ws = (currentUser.workspace.settings ?? {}) as Record<string, unknown>;
  const tt = (ws.time_tracking ?? {}) as Partial<TimeTrackingSettings>;

  const settings: TimeTrackingSettings = {
    default_billable:  tt.default_billable  ?? true,
    rounding_minutes:  tt.rounding_minutes  ?? 0,
    hours_per_day:     tt.hours_per_day     ?? 8,
    idle_timeout_mins: tt.idle_timeout_mins ?? 0,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Time Tracking" subtitle="Configure time tracking defaults and behavior for your workspace." />
      <TimeTrackingClient initial={settings} />
    </div>
  );
}
