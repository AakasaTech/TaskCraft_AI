'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { SettingsSection, SettingsRow } from '@/components/shared/SettingsSection';
import { changePassword, signOutAllSessions } from '../../actions';

export function SecurityClient() {
  const router = useRouter();

  const [current,   setCurrent]   = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [isPending, startTransition]       = useTransition();
  const [isSignOut, startSignOutTransition] = useTransition();

  function handleChangePassword() {
    if (!current || !newPw || !confirm) {
      toast.error('Please fill in all fields.');
      return;
    }
    if (newPw !== confirm) {
      toast.error('New passwords do not match.');
      return;
    }
    if (newPw.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    startTransition(async () => {
      const res = await changePassword({ currentPassword: current, newPassword: newPw });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Password updated successfully.');
        setCurrent('');
        setNewPw('');
        setConfirm('');
      }
    });
  }

  function handleSignOutAll() {
    startSignOutTransition(async () => {
      const res = await signOutAllSessions();
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Signed out of all sessions.');
        router.push('/login');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Change password */}
      <SettingsSection
        title="Change Password"
        description="Update your account password. Choose something strong and unique."
        footer={
          <button onClick={handleChangePassword} disabled={isPending} className="tc-btn-primary">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
          </button>
        }
      >
        <div className="space-y-4">
          <SettingsRow label="Current password">
            <Input
              id="current"
              type="password"
              placeholder="••••••••"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </SettingsRow>
          <div className="h-px bg-border" />
          <SettingsRow label="New password">
            <Input
              id="new"
              type="password"
              placeholder="Min. 8 characters"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
          </SettingsRow>
          <SettingsRow label="Confirm new password">
            <Input
              id="confirm"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Active sessions */}
      <SettingsSection title="Active Sessions" description="Sessions where you are currently signed in.">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Current session</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Active now</p>
            </div>
            <span className="ml-auto status-active">Active</span>
          </div>
        </div>
        <button
          onClick={handleSignOutAll}
          disabled={isSignOut}
          className="tc-btn-secondary mt-4 text-xs inline-flex items-center gap-1.5"
        >
          {isSignOut && <Loader2 className="h-3 w-3 animate-spin" />}
          Sign out all other sessions
        </button>
      </SettingsSection>
    </div>
  );
}
