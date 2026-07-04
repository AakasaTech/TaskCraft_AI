'use client';

import { useState, useTransition, useRef } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SettingsSection, SettingsRow } from '@/components/shared/SettingsSection';
import { createClient } from '@/lib/supabase/client';
import { updateProfile } from '../actions';

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
  userId:    string;
  email:     string;
  fullName:  string;
  avatarUrl: string | null;
  timezone:  string;
  initials:  string;
}

export function ProfileClient({ userId, email, fullName, avatarUrl, timezone, initials }: Props) {
  const [name,       setName]       = useState(fullName);
  const [tz,         setTz]         = useState(timezone);
  const [avatar,     setAvatar]     = useState<string | null>(avatarUrl);
  const [uploading,  setUploading]  = useState(false);
  const [isPending,  startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext ?? '')) {
      toast.error('Please upload a JPG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be smaller than 2 MB.');
      return;
    }

    setUploading(true);
    try {
      const supabase  = createClient();
      const path      = `${userId}/avatar.${ext}`;
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const res = await updateProfile({ avatar_url: newUrl });
      if (res.error) throw new Error(res.error);

      setAvatar(newUrl);
      toast.success('Avatar updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updateProfile({ full_name: name, timezone: tz });
      if (res.error) toast.error(res.error);
      else toast.success('Profile saved.');
    });
  }

  const displayInitials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : initials;

  return (
    <SettingsSection
      title="Profile"
      description="Update your name, avatar, and timezone."
      footer={
        <button onClick={handleSave} disabled={isPending} className="tc-btn-primary">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
        </button>
      }
    >
      <div className="space-y-5">
        <SettingsRow label="Avatar" description="JPG, PNG or WebP up to 2 MB.">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={avatar ?? undefined} />
              <AvatarFallback className="text-base font-semibold">{displayInitials}</AvatarFallback>
            </Avatar>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="tc-btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? 'Uploading…' : 'Change avatar'}
            </button>
          </div>
        </SettingsRow>

        <div className="h-px bg-border" />

        <SettingsRow label="Full name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </SettingsRow>

        <SettingsRow label="Email" description="Your email address cannot be changed.">
          <Input value={email} disabled />
        </SettingsRow>

        <div className="h-px bg-border" />

        <SettingsRow label="Timezone" description="Used for due dates and time entry display.">
          <select
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </SettingsRow>
      </div>
    </SettingsSection>
  );
}
