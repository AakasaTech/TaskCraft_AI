import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { TimeTrackingClient } from './_components/TimeTrackingClient';
import type { TimeTrackingSettings } from '../actions';

export const metadata: Metadata = { title: 'Time Tracking Settings' };

export default async function TimeTrackingSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle();

  let settings: TimeTrackingSettings = {
    default_billable:  true,
    rounding_minutes:  0,
    hours_per_day:     8,
    idle_timeout_mins: 0,
  };

  if (member?.workspace_id) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', member.workspace_id)
      .single();

    const ws = (workspace?.settings ?? {}) as Record<string, unknown>;
    const tt = (ws.time_tracking ?? {}) as Partial<TimeTrackingSettings>;

    settings = {
      default_billable:  tt.default_billable  ?? true,
      rounding_minutes:  tt.rounding_minutes  ?? 0,
      hours_per_day:     tt.hours_per_day     ?? 8,
      idle_timeout_mins: tt.idle_timeout_mins ?? 0,
    };
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Time Tracking" subtitle="Configure time tracking defaults and behavior for your workspace." />
      <TimeTrackingClient initial={settings} />
    </div>
  );
}
