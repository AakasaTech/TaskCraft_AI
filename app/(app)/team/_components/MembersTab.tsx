'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  UserPlus, MoreHorizontal, Trash2, Shield, Mail, Clock, ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { removeMember, changeMemberRole, cancelInvitation } from '../actions';
import { InviteModal } from './InviteModal';
import type { WorkspaceInvitation } from '@/lib/types';

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string | null;
  profiles: { full_name: string | null; avatar_url: string | null; email: string } | null;
}

interface Project {
  id: string;
  name: string;
  color: string;
  status: string;
}

interface Props {
  currentUserId:   string;
  currentUserRole: string;
  members:         Member[];
  pendingInvites:  WorkspaceInvitation[];
  projects:        Project[];
}

const ROLE_LABELS: Record<string, string> = {
  owner:   'Owner',
  admin:   'Admin',
  manager: 'Project Manager',
  member:  'Member',
  viewer:  'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  owner:   'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  admin:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  manager: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  member:  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  viewer:  'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const ASSIGNABLE_ROLES = ['admin', 'manager', 'member', 'viewer'];

function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  return email[0]?.toUpperCase() ?? 'U';
}

function timeAgo(date: string | null) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function MembersTab({ currentUserId, currentUserRole, members, pendingInvites, projects }: Props) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  function handleRemove(id: string, name: string) {
    if (!confirm(`Remove ${name} from the workspace?`)) return;
    startTransition(async () => {
      const result = await removeMember(id);
      if (result.error) toast.error(result.error);
      else toast.success(`${name} removed from workspace`);
    });
  }

  function handleRoleChange(id: string, newRole: string) {
    startTransition(async () => {
      const result = await changeMemberRole(id, newRole);
      if (result.error) toast.error(result.error);
      else toast.success('Role updated');
    });
  }

  function handleCancelInvite(id: string) {
    startTransition(async () => {
      const result = await cancelInvitation(id);
      if (result.error) toast.error(result.error);
      else toast.success('Invitation cancelled');
    });
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        </div>
      )}

      {/* Members list */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Members ({members.length})
          </p>
        </div>
        <div className="divide-y divide-border">
          {members.map((m) => {
            const profile = m.profiles;
            const name = profile?.full_name ?? profile?.email ?? 'Unknown';
            const email = profile?.email ?? '';
            const isYou = m.user_id === currentUserId;
            const canChangeThisRole =
              canManage &&
              !isYou &&
              m.role !== 'owner' &&
              !(m.role === 'admin' && currentUserRole !== 'owner');
            const canRemoveThis =
              canManage &&
              !isYou &&
              m.role !== 'owner' &&
              !(m.role === 'admin' && currentUserRole !== 'owner');

            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[11px] font-semibold">
                    {initials(profile?.full_name ?? null, email)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{name}</p>
                    {isYou && (
                      <span className="text-[10px] text-muted-foreground font-medium">(you)</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{email}</p>
                </div>

                {/* Role */}
                <div className="flex items-center gap-2">
                  {canChangeThisRole ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) => handleRoleChange(m.id, v)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="h-7 text-xs w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r} className="text-xs">
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', ROLE_COLORS[m.role] ?? ROLE_COLORS.member)}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  )}

                  {m.joined_at && (
                    <span className="hidden sm:inline text-[11px] text-muted-foreground whitespace-nowrap">
                      Joined {timeAgo(m.joined_at)}
                    </span>
                  )}

                  {canRemoveThis && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleRemove(m.id, name)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Remove from workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Pending Invitations ({pendingInvites.length})
            </p>
          </div>
          <div className="divide-y divide-border">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold', ROLE_COLORS[inv.role] ?? ROLE_COLORS.member)}>
                      {ROLE_LABELS[inv.role] ?? inv.role}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleCancelInvite(inv.id)}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects overview */}
      {projects.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Projects ({projects.length})
            </p>
          </div>
          <div className="divide-y divide-border">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                <a
                  href={`/projects/${p.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  Manage members →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}
