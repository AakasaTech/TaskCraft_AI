import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsSection, SettingsRow } from '@/components/shared/SettingsSection';
import { ProfileClient } from './_components/ProfileClient';

export const metadata: Metadata = { title: 'Profile Settings' };

export default async function ProfileSettingsPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const profile = currentUser.profile;

  const initials = profile?.fullName
    ? profile.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : currentUser.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Settings" subtitle="Manage your account and preferences" />

      <ProfileClient
        userId={currentUser.id}
        email={currentUser.email ?? ''}
        fullName={profile?.fullName ?? ''}
        avatarUrl={profile?.avatarUrl ?? null}
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
