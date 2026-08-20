import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { TeamClient } from './_components/TeamClient';
import { getEffectivePlan } from '@/lib/plan-gates';
import type { Plan } from '@/lib/types';

export const metadata: Metadata = { title: 'Team Management' };

export default async function TeamPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const effectivePlan = getEffectivePlan(
    currentUser.profile.plan as Plan,
    currentUser.profile.planExpiresAt?.toISOString() ?? null
  );

  if (effectivePlan !== 'team') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="rounded-2xl border border-border bg-card p-8 max-w-md w-full">
          <div className="text-4xl mb-3">👥</div>
          <h1 className="text-xl font-bold mb-1">Team Management</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Invite your team, assign roles, view workloads and timesheets. Requires the Team plan.
          </p>
          <div className="space-y-2 text-sm text-left mb-6">
            {[
              'Unlimited team members',
              'Role-based access control',
              'Team workload & timesheet views',
              'Project-level permissions',
              'Team activity feed',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
          <Link
            href="/settings/billing"
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Upgrade to Team — $19/mo
          </Link>
        </div>
      </div>
    );
  }

  const wid = currentUser.workspace.id;

  const [membersRes, invitesRes, projectsRes] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: wid },
      include: {
        user: { select: { fullName: true, avatarUrl: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

    prisma.workspaceInvitation.findMany({
      where: {
        workspaceId: wid,
        acceptedAt:  null,
        expiresAt:   { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.project.findMany({
      where: {
        workspaceId: wid,
        status: { not: 'archived' },
      },
      select: { id: true, name: true, color: true, status: true },
      orderBy: { position: 'asc' },
    }),
  ]);

  const members = membersRes.map((m) => ({
    id:       m.id,
    user_id:  m.userId,
    role:     m.role,
    joined_at: m.joinedAt?.toISOString() ?? null,
    profiles: {
      full_name:  m.user.fullName,
      avatar_url: m.user.avatarUrl,
      email:      m.user.email,
    },
  }));

  const pendingInvites = invitesRes.map((i) => ({
    id:           i.id,
    workspace_id: i.workspaceId,
    email:        i.email,
    role:         i.role,
    token:        i.token,
    invited_by:   i.invitedById,
    accepted_at:  i.acceptedAt?.toISOString() ?? null,
    expires_at:   i.expiresAt.toISOString(),
    created_at:   i.createdAt.toISOString(),
  }));

  const projects = projectsRes.map((p) => ({
    id:     p.id,
    name:   p.name,
    color:  p.color,
    status: p.status,
  }));

  return (
    <TeamClient
      currentUserId={currentUser.profile.id}
      currentUserRole={currentUser.membership.role}
      workspaceId={wid}
      members={members}
      pendingInvites={pendingInvites as any}
      projects={projects as any}
    />
  );
}
