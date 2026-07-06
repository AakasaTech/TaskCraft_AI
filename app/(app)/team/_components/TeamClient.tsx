'use client';

import { useState } from 'react';
import { Users, BarChart2, Clock, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MembersTab } from './MembersTab';
import { WorkloadTab } from './WorkloadTab';
import { TimesheetTab } from './TimesheetTab';
import { ActivityTab } from './ActivityTab';
import type { WorkspaceInvitation } from '@/lib/types';

type Tab = 'members' | 'workload' | 'timesheet' | 'activity';

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
  currentUserId:    string;
  currentUserRole:  string;
  workspaceId:      string;
  members:          Member[];
  pendingInvites:   WorkspaceInvitation[];
  projects:         Project[];
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'members',   label: 'Members',   icon: Users },
  { id: 'workload',  label: 'Workload',  icon: BarChart2 },
  { id: 'timesheet', label: 'Timesheet', icon: Clock },
  { id: 'activity',  label: 'Activity',  icon: Activity },
];

export function TeamClient({ currentUserId, currentUserRole, workspaceId, members, pendingInvites, projects }: Props) {
  const [tab, setTab] = useState<Tab>('members');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Team Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {members.length} {members.length === 1 ? 'member' : 'members'} · {pendingInvites.length} pending {pendingInvites.length === 1 ? 'invite' : 'invites'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'members' && (
        <MembersTab
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          members={members}
          pendingInvites={pendingInvites}
          projects={projects}
        />
      )}
      {tab === 'workload'  && <WorkloadTab />}
      {tab === 'timesheet' && <TimesheetTab />}
      {tab === 'activity'  && <ActivityTab members={members} />}
    </div>
  );
}
