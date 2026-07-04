'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SettingsSection } from '@/components/shared/SettingsSection';
import { updateNotificationPrefs, type NotificationPrefs } from '../../actions';

const NOTIFS: { id: keyof NotificationPrefs; label: string; sub: string }[] = [
  { id: 'task_assigned',   label: 'Task assigned to me',  sub: 'When someone assigns a task to you' },
  { id: 'task_due',        label: 'Task due soon',         sub: 'Reminder 24 hours before a task is due' },
  { id: 'project_updates', label: 'Project updates',       sub: 'When a project status changes' },
  { id: 'billing',         label: 'Billing notifications', sub: 'Receipts, renewals, and payment issues' },
  { id: 'weekly_summary',  label: 'Weekly summary email',  sub: 'A weekly digest of your productivity' },
];

interface Props {
  initialPrefs: NotificationPrefs;
}

export function NotificationsClient({ initialPrefs }: Props) {
  const [prefs, setPrefs]         = useState<NotificationPrefs>(initialPrefs);
  const [isPending, startTransition] = useTransition();

  function toggle(id: keyof NotificationPrefs) {
    setPrefs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updateNotificationPrefs(prefs);
      if (res.error) toast.error(res.error);
      else toast.success('Notification preferences saved.');
    });
  }

  return (
    <SettingsSection
      title="Email Notifications"
      description="Choose which notifications you want to receive by email."
      footer={
        <button onClick={handleSave} disabled={isPending} className="tc-btn-primary">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save preferences'}
        </button>
      }
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
              <Switch
                id={n.id}
                checked={prefs[n.id]}
                onCheckedChange={() => toggle(n.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
