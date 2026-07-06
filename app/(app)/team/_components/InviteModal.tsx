'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { X, Copy, Check, Loader2, Mail } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { inviteMember } from '../actions';

interface Props {
  onClose: () => void;
}

const ROLES = [
  { value: 'admin',   label: 'Admin',           description: 'Can manage projects and team members' },
  { value: 'manager', label: 'Project Manager',  description: 'Can manage assigned projects and tasks' },
  { value: 'member',  label: 'Member',           description: 'Can create and work on tasks' },
  { value: 'viewer',  label: 'Viewer',           description: 'Read-only access' },
];

export function InviteModal({ onClose }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      const result = await inviteMember(email.trim(), role);
      if (result.error) {
        toast.error(result.error);
      } else {
        setInviteUrl(result.data!.inviteUrl);
        toast.success('Invitation created');
      }
    });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Invite Team Member</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!inviteUrl ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <p className="text-sm font-medium">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !email.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Send Invite
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3 text-sm text-green-700 dark:text-green-400">
              Invitation created for <strong>{email}</strong> as <strong>{ROLES.find((r) => r.value === role)?.label}</strong>.
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Share this invite link</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="flex-1 rounded-lg border border-input bg-muted px-3 py-2 text-xs text-muted-foreground"
                />
                <button
                  onClick={handleCopy}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This link expires in 7 days. Anyone with the link who is logged in can use it.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setInviteUrl(''); setEmail(''); }}
                className="flex-1 rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                Invite Another
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
