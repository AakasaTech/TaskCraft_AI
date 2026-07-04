import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSection, SettingsRow } from '@/components/shared/SettingsSection';
import { ProfileClient } from './_components/ProfileClient';

export const metadata: Metadata = { title: 'Profile Settings' };

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, timezone')
    .eq('id', user.id)
    .single();

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      <ProfileClient
        userId={user.id}
        email={user.email ?? ''}
        fullName={profile?.full_name ?? ''}
        avatarUrl={profile?.avatar_url ?? null}
        timezone={profile?.timezone ?? 'UTC'}
        initials={initials}
      />

      {/* Danger zone */}
      <SettingsSection title="Danger Zone">
        <SettingsRow
          label="Delete account"
          description="Permanently delete your account and all associated data. This cannot be undone."
        >
          <button className="tc-btn-secondary border-destructive/40 text-destructive hover:bg-destructive/5 text-xs">
            Delete account
          </button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
