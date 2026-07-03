import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSection, SettingsRow } from '@/components/shared/SettingsSection';

export const metadata: Metadata = { title: 'Settings' };

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      {/* Profile */}
      <SettingsSection
        title="Profile"
        description="Update your name and avatar."
        footer={
          <button className="tc-btn-primary">Save changes</button>
        }
      >
        <div className="space-y-5">
          <SettingsRow label="Avatar" description="Click to upload a new profile picture.">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-base font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <button className="tc-btn-secondary text-xs">Change avatar</button>
            </div>
          </SettingsRow>

          <div className="h-px bg-border" />

          <SettingsRow label="Full name">
            <Input defaultValue={profile?.full_name ?? ''} placeholder="Your name" />
          </SettingsRow>

          <SettingsRow label="Email" description="Your email address cannot be changed here.">
            <Input defaultValue={user?.email ?? ''} disabled />
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Danger zone */}
      <SettingsSection title="Danger Zone">
        <SettingsRow
          label="Delete account"
          description="Permanently delete your account and all associated data. This action cannot be undone."
        >
          <button className="tc-btn-secondary border-destructive/40 text-destructive hover:bg-destructive/5">
            Delete account
          </button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
