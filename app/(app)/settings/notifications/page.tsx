import type { Metadata } from 'next';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SettingsSection } from '@/components/shared/SettingsSection';

export const metadata: Metadata = { title: 'Notifications' };

const NOTIFS = [
  { id: 'task_assigned',   label: 'Task assigned to me',   sub: 'When someone assigns a task to you' },
  { id: 'task_due',        label: 'Task due soon',          sub: 'Reminder 24 hours before a task is due' },
  { id: 'project_updates', label: 'Project updates',        sub: 'When a project status changes' },
  { id: 'billing',         label: 'Billing notifications',  sub: 'Receipts, renewals, and payment issues' },
  { id: 'weekly_summary',  label: 'Weekly summary email',   sub: 'A weekly digest of your productivity' },
];

export default function NotificationsPage() {
  return (
    <SettingsSection
      title="Email Notifications"
      description="Choose which notifications you want to receive by email."
      footer={<button className="tc-btn-primary">Save preferences</button>}
    >
      <div className="space-y-5">
        {NOTIFS.map((n, i) => (
          <div key={n.id}>
            {i > 0 && <div className="mb-5 h-px bg-border" />}
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor={n.id} className="cursor-pointer text-sm font-medium">{n.label}</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.sub}</p>
              </div>
              <Switch id={n.id} defaultChecked />
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
