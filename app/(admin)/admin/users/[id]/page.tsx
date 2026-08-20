import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/helpers'
import { GrantFreepassDialog } from './grant-freepass-dialog'
import { ChevronLeft, Gift } from 'lucide-react'

export const metadata = { title: 'User Detail — Admin', robots: 'noindex, nofollow' }

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { dateStyle: 'medium' })
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-gray-400">{label}</span>
      <span className="text-right text-sm text-white">{value}</span>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const currentUser = await getAuthUser()
  if (!currentUser) redirect('/login')

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!adminEmails.includes(currentUser.email?.toLowerCase() ?? '')) redirect('/dashboard')

  const now = new Date()

  const profile = await prisma.profile.findUnique({
    where: { id },
    select: {
      id: true, userId: true, email: true, fullName: true, timezone: true, plan: true,
      planExpiresAt: true, isAdmin: true, onboarded: true, createdAt: true,
      user: { select: { bannedUntil: true } },
    },
  })

  if (!profile) notFound()

  const [sub, wsCount, projectCount] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId: profile.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, planId: true, trialEndsAt: true, currentPeriodStart: true, currentPeriodEnd: true, createdAt: true },
    }),
    prisma.workspace.count({ where: { ownerId: profile.id } }),
    prisma.project.count({ where: { createdById: profile.id } }),
  ])

  const isBanned   = !!(profile.user.bannedUntil && profile.user.bannedUntil > now)
  const hasFreepass = profile.plan !== 'free' && profile.planExpiresAt !== null
  const isTrialing  = sub?.status === 'trialing' && sub.trialEndsAt && sub.trialEndsAt > now

  const planStatus = sub?.status === 'active'
    ? profile.plan
    : isTrialing ? 'trialing'
    : hasFreepass ? 'freepass'
    : profile.plan === 'free' ? 'free'
    : 'expired'

  const planColor = sub?.status === 'active'
    ? (profile.plan === 'team' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400')
    : isTrialing ? 'bg-amber-500/20 text-amber-400'
    : hasFreepass ? 'bg-violet-500/20 text-violet-400'
    : 'bg-gray-500/20 text-gray-400'

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/users" className="text-gray-400 hover:text-white">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{profile.fullName ?? profile.email}</h1>
          <p className="text-sm text-gray-400">{profile.fullName ? profile.email : ''}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Workspaces', value: wsCount },
          { label: 'Projects',   value: projectCount },
          { label: 'Plan',       value: profile.plan.toUpperCase() },
          { label: 'Status',     value: <Badge label={planStatus} color={planColor} /> },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-gray-900 p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile info */}
        <div className="rounded-xl border border-white/10 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Profile</h2>
          <InfoRow label="ID" value={<code className="text-xs text-gray-400">{profile.id}</code>} />
          <InfoRow label="Timezone" value={profile.timezone} />
          <InfoRow label="Onboarded" value={profile.onboarded ? 'Yes' : 'No'} />
          <InfoRow label="Admin" value={profile.isAdmin ? 'Yes' : 'No'} />
          <InfoRow
            label="Auth status"
            value={
              <Badge
                label={isBanned ? 'Suspended' : 'Active'}
                color={isBanned ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}
              />
            }
          />
          <InfoRow label="Joined" value={fmtDate(profile.createdAt)} />
        </div>

        {/* Subscription */}
        <div className="rounded-xl border border-white/10 bg-gray-900 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">Subscription</h2>
          {sub ? (
            <>
              <InfoRow label="Plan" value={sub.planId} />
              <InfoRow
                label="Status"
                value={
                  <Badge
                    label={sub.status}
                    color={
                      sub.status === 'active'   ? 'bg-emerald-500/20 text-emerald-400' :
                      sub.status === 'trialing' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-gray-500/20 text-gray-400'
                    }
                  />
                }
              />
              <InfoRow label="Trial ends"  value={fmtDate(sub.trialEndsAt)} />
              <InfoRow label="Period end"  value={fmtDate(sub.currentPeriodEnd)} />
            </>
          ) : (
            <p className="text-sm text-gray-500">No subscription</p>
          )}
        </div>
      </div>

      {/* Free Pass */}
      <div className="rounded-xl border border-white/10 bg-gray-900 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Gift className="h-4 w-4 text-violet-400" />
              Free Pass
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              {hasFreepass
                ? `Active · ${profile.plan} plan${profile.planExpiresAt ? ` until ${fmtDate(profile.planExpiresAt)}` : ' (permanent)'}`
                : 'No active free pass'}
            </p>
          </div>
          <GrantFreepassDialog
            userId={profile.id}
            subscriptionId={sub?.id ?? null}
            trialEndsAt={sub?.trialEndsAt ? sub.trialEndsAt.toISOString() : null}
            currentPlan={profile.plan}
            currentPlanExpiresAt={profile.planExpiresAt ? profile.planExpiresAt.toISOString() : null}
          />
        </div>
      </div>
    </div>
  )
}
