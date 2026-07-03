import type { Metadata } from 'next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection, SettingsRow } from '@/components/shared/SettingsSection';

export const metadata: Metadata = { title: 'Security' };

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      {/* Change password */}
      <SettingsSection
        title="Change Password"
        description="Update your account password. Choose something strong and unique."
        footer={<button className="tc-btn-primary">Update password</button>}
      >
        <div className="space-y-4">
          <SettingsRow label="Current password">
            <Input id="current" type="password" placeholder="••••••••" />
          </SettingsRow>
          <div className="h-px bg-border" />
          <SettingsRow label="New password">
            <Input id="new" type="password" placeholder="Min. 8 characters" />
          </SettingsRow>
          <SettingsRow label="Confirm new password">
            <Input id="confirm" type="password" placeholder="••••••••" />
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Active sessions */}
      <SettingsSection title="Active Sessions" description="Sessions where you are currently signed in.">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Current session</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Active now</p>
            </div>
            <span className="status-active">Active</span>
          </div>
        </div>
        <button className="tc-btn-secondary mt-4 text-xs">Sign out all other sessions</button>
      </SettingsSection>
    </div>
  );
}
