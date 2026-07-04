'use client';

import { useState, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SettingsSection, SettingsRow } from '@/components/shared/SettingsSection';
import { createClient } from '@/lib/supabase/client';
import { updateWorkspace, type WorkspaceSettings } from '../../actions';

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar'           },
  { value: 'EUR', label: 'EUR — Euro'                 },
  { value: 'GBP', label: 'GBP — British Pound'        },
  { value: 'AUD', label: 'AUD — Australian Dollar'    },
  { value: 'CAD', label: 'CAD — Canadian Dollar'      },
  { value: 'JPY', label: 'JPY — Japanese Yen'         },
  { value: 'CHF', label: 'CHF — Swiss Franc'          },
  { value: 'INR', label: 'INR — Indian Rupee'         },
  { value: 'SGD', label: 'SGD — Singapore Dollar'     },
  { value: 'NZD', label: 'NZD — New Zealand Dollar'   },
  { value: 'SEK', label: 'SEK — Swedish Krona'        },
  { value: 'NOK', label: 'NOK — Norwegian Krone'      },
  { value: 'DKK', label: 'DKK — Danish Krone'         },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar'     },
  { value: 'ZAR', label: 'ZAR — South African Rand'   },
  { value: 'BRL', label: 'BRL — Brazilian Real'       },
  { value: 'MXN', label: 'MXN — Mexican Peso'         },
  { value: 'LKR', label: 'LKR — Sri Lankan Rupee'     },
];

const TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'America/Toronto', 'America/Vancouver',
  'America/Sao_Paulo', 'America/Buenos_Aires',
  'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Amsterdam', 'Europe/Madrid', 'Europe/Rome', 'Europe/Stockholm',
  'Europe/Oslo', 'Europe/Warsaw', 'Europe/Helsinki', 'Europe/Athens',
  'Europe/Istanbul', 'Europe/Moscow',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Colombo',
  'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Jakarta', 'Asia/Singapore',
  'Asia/Kuala_Lumpur', 'Asia/Manila', 'Asia/Shanghai', 'Asia/Taipei',
  'Asia/Seoul', 'Asia/Tokyo',
  'Australia/Perth', 'Australia/Adelaide', 'Australia/Sydney', 'Australia/Melbourne',
  'Pacific/Auckland', 'Pacific/Honolulu',
];

interface Props {
  workspaceId:    string;
  workspaceName:  string;
  avatarUrl:      string | null;
  settings:       Record<string, unknown>;
  canEdit:        boolean;
}

export function WorkspaceSettingsClient({
  workspaceId,
  workspaceName,
  avatarUrl,
  settings,
  canEdit,
}: Props) {
  const ws = settings as WorkspaceSettings & Record<string, unknown>;

  const [name,        setName]        = useState(workspaceName);
  const [logo,        setLogo]        = useState<string | null>(avatarUrl);
  const [currency,    setCurrency]    = useState<string>(ws.currency   ?? 'USD');
  const [hourlyRate,  setHourlyRate]  = useState<string>(ws.hourly_rate != null ? String(ws.hourly_rate) : '');
  const [timezone,    setTimezone]    = useState<string>(ws.timezone   ?? 'UTC');
  const [weekStart,   setWeekStart]   = useState<string>(ws.work_week_start ?? 'monday');
  const [dateFormat,  setDateFormat]  = useState<string>(ws.date_format ?? 'MM/DD/YYYY');
  const [timeFormat,  setTimeFormat]  = useState<string>(ws.time_format ?? '12h');

  const [uploading,   setUploading]   = useState(false);
  const [isPending,   startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '')) {
      toast.error('Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2 MB.');
      return;
    }

    setUploading(true);
    try {
      const supabase  = createClient();
      const path      = `${workspaceId}/logo.${ext}`;
      const { error } = await supabase.storage
        .from('workspace-logos')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('workspace-logos')
        .getPublicUrl(path);

      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const res = await updateWorkspace({ avatar_url: newUrl });
      if (res.error) throw new Error(res.error);

      setLogo(newUrl);
      toast.success('Logo updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    startTransition(async () => {
      const rate = hourlyRate.trim() ? parseFloat(hourlyRate) : null;
      if (hourlyRate.trim() && (isNaN(rate!) || rate! < 0)) {
        toast.error('Hourly rate must be a positive number.');
        return;
      }

      const res = await updateWorkspace({
        name,
        settings: {
          currency,
          hourly_rate:     rate,
          timezone,
          work_week_start: weekStart as 'monday' | 'sunday',
          date_format:     dateFormat,
          time_format:     timeFormat as '12h' | '24h',
        },
      });

      if (res.error) toast.error(res.error);
      else toast.success('Workspace settings saved.');
    });
  }

  const nameInitials = name.slice(0, 2).toUpperCase();

  if (!canEdit) {
    return (
      <SettingsSection title="Workspace" description="Workspace settings.">
        <p className="text-sm text-muted-foreground">
          Only workspace owners and admins can edit these settings.
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Workspace"
      description="Configure your workspace name, branding, and regional preferences."
      footer={
        <button onClick={handleSave} disabled={isPending} className="tc-btn-primary">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
        </button>
      }
    >
      <div className="space-y-5">
        {/* Logo */}
        <SettingsRow label="Workspace logo" description="JPG or PNG up to 2 MB.">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 rounded-xl">
              <AvatarImage src={logo ?? undefined} className="rounded-xl" />
              <AvatarFallback className="rounded-xl text-base font-semibold">
                {logo ? nameInitials : <Building2 className="h-6 w-6 text-muted-foreground" />}
              </AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="tc-btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? 'Uploading…' : 'Upload logo'}
            </button>
          </div>
        </SettingsRow>

        <div className="h-px bg-border" />

        {/* Workspace name */}
        <SettingsRow label="Workspace name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your workspace name"
          />
        </SettingsRow>

        <div className="h-px bg-border" />

        {/* Regional */}
        <SettingsRow label="Default currency" description="Used for time entries and invoicing.">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </SettingsRow>

        <SettingsRow label="Default hourly rate" description="Default rate applied to new time entries (optional).">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              className="pl-7"
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </SettingsRow>

        <SettingsRow label="Timezone" description="Default timezone for the workspace.">
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </SettingsRow>

        <div className="h-px bg-border" />

        {/* Date/time format */}
        <SettingsRow label="Work week starts on">
          <select
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </SettingsRow>

        <SettingsRow label="Date format">
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
            <option value="D MMM YYYY">D MMM YYYY (31 Dec 2025)</option>
          </select>
        </SettingsRow>

        <SettingsRow label="Time format">
          <select
            value={timeFormat}
            onChange={(e) => setTimeFormat(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="12h">12-hour (3:30 PM)</option>
            <option value="24h">24-hour (15:30)</option>
          </select>
        </SettingsRow>
      </div>
    </SettingsSection>
  );
}
