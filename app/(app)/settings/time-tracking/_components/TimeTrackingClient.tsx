'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { SettingsSection, SettingsRow } from '@/components/shared/SettingsSection';
import { updateTimeTrackingSettings, type TimeTrackingSettings } from '../../actions';

interface Props {
  initial: TimeTrackingSettings;
}

export function TimeTrackingClient({ initial }: Props) {
  const [billable,      setBillable]      = useState(initial.default_billable  ?? true);
  const [rounding,      setRounding]      = useState<string>(String(initial.rounding_minutes ?? 0));
  const [hoursPerDay,   setHoursPerDay]   = useState<string>(String(initial.hours_per_day ?? 8));
  const [idleTimeout,   setIdleTimeout]   = useState<string>(String(initial.idle_timeout_mins ?? 0));
  const [isPending,     startTransition]  = useTransition();

  function handleSave() {
    const hours = parseFloat(hoursPerDay);
    if (isNaN(hours) || hours < 1 || hours > 24) {
      toast.error('Working hours per day must be between 1 and 24.');
      return;
    }

    startTransition(async () => {
      const res = await updateTimeTrackingSettings({
        default_billable:  billable,
        rounding_minutes:  parseInt(rounding) as 0 | 5 | 10 | 15 | 30,
        hours_per_day:     hours,
        idle_timeout_mins: parseInt(idleTimeout),
      });
      if (res.error) toast.error(res.error);
      else toast.success('Time tracking settings saved.');
    });
  }

  return (
    <SettingsSection
      title="Time Tracking"
      description="Configure defaults and behavior for time tracking across your workspace."
      footer={
        <button onClick={handleSave} disabled={isPending} className="tc-btn-primary">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
        </button>
      }
    >
      <div className="space-y-5">
        <SettingsRow
          label="Billable by default"
          description="New time entries are marked as billable automatically."
        >
          <Switch
            id="default-billable"
            checked={billable}
            onCheckedChange={setBillable}
          />
        </SettingsRow>

        <div className="h-px bg-border" />

        <SettingsRow
          label="Time rounding"
          description="Round time entries up to the nearest increment."
        >
          <select
            value={rounding}
            onChange={(e) => setRounding(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="0">No rounding</option>
            <option value="5">Round to 5 minutes</option>
            <option value="10">Round to 10 minutes</option>
            <option value="15">Round to 15 minutes</option>
            <option value="30">Round to 30 minutes</option>
          </select>
        </SettingsRow>

        <SettingsRow
          label="Working hours per day"
          description="Used for overtime calculations and daily progress reports."
        >
          <div className="relative">
            <Input
              type="number"
              min="1"
              max="24"
              step="0.5"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
              className="pr-14"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              hrs/day
            </span>
          </div>
        </SettingsRow>

        <div className="h-px bg-border" />

        <SettingsRow
          label="Idle timer alert"
          description="Warn when a timer has been running without activity."
        >
          <select
            value={idleTimeout}
            onChange={(e) => setIdleTimeout(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="0">Disabled</option>
            <option value="30">After 30 minutes</option>
            <option value="60">After 1 hour</option>
            <option value="120">After 2 hours</option>
            <option value="240">After 4 hours</option>
          </select>
        </SettingsRow>
      </div>
    </SettingsSection>
  );
}
