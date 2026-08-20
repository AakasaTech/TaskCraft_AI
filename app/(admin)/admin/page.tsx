import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Users, TrendingUp, Activity, DollarSign, Clock } from 'lucide-react'

export const metadata: Metadata = { title: 'Admin — TaskCraft AI', robots: 'noindex, nofollow' }

function fmt(n: number | null | undefined) {
  return (n ?? 0).toLocaleString()
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { dateStyle: 'medium' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    solo:     'bg-blue-500/20 text-blue-400',
    team:     'bg-purple-500/20 text-purple-400',
    free:     'bg-gray-500/20 text-gray-400',
    trialing: 'bg-amber-500/20 text-amber-400',
    freepass: 'bg-violet-500/20 text-violet-400',
    expired:  'bg-red-500/20 text-red-400',
  }
  const cls = map[status] ?? 'bg-gray-500/20 text-gray-400'
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

export default async function AdminDashboardPage() {
  const now = new Date()

  const [profiles, subs] = await Promise.all([
    prisma.profile.findMany({
      select: { id: true, userId: true, email: true, fullName: true, plan: true, planExpiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.subscription.findMany({
      where: { status: { in: ['trialing', 'active'] } },
      select: { userId: true, status: true, planId: true, trialEndsAt: true },
    }),
  ])

  const subByUser = Object.fromEntries(subs.map((s) => [s.userId, s]))

  const totalUsers = profiles.length
  const paidUsers  = profiles.filter((p) => p.plan !== 'free').length
  const soloCount  = profiles.filter((p) => p.plan === 'solo').length
  const teamCount  = profiles.filter((p) => p.plan === 'team').length
  const trialCount = subs.filter((s) => s.status === 'trialing').length
  const mrr        = soloCount * 9 + teamCount * 19
  const conversion = totalUsers ? Math.round((paidUsers / totalUsers) * 100) : 0

  const statCards = [
    { label: 'Total users',       value: fmt(totalUsers), icon: Users,      color: 'text-blue-400' },
    { label: 'Paid users',        value: fmt(paidUsers),  icon: Activity,   color: 'text-emerald-400' },
    { label: 'Trial users',       value: fmt(trialCount), icon: Clock,      color: 'text-amber-400' },
    { label: 'Est. monthly rev.', value: `$${fmt(mrr)}`,  icon: DollarSign, color: 'text-violet-400' },
  ]

  const recentUsers = profiles.slice(0, 10)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Platform overview as of {now.toLocaleDateString('en-US', { dateStyle: 'long' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-white/10 bg-gray-900 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">{label}</p>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Plan breakdown */}
        <div className="rounded-xl border border-white/10 bg-gray-900 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            Plan breakdown
          </h2>
          <ul className="space-y-2">
            {[['Solo', soloCount], ['Team', teamCount]].map(([plan, count]) => (
              <li key={String(plan)} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{plan}</span>
                <span className="font-semibold text-white">{count}</span>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-white/10 pt-2 text-sm">
              <span className="text-gray-400">Conversion rate</span>
              <span className="font-semibold text-white">{conversion}%</span>
            </li>
          </ul>
        </div>

        {/* Recent signups */}
        <div className="col-span-2 rounded-xl border border-white/10 bg-gray-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Clock className="h-4 w-4 text-purple-400" />
              Recent signups
            </h2>
            <Link href="/admin/users" className="text-xs text-blue-400 hover:text-blue-300">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-gray-500">
                  <th className="pb-2 text-left font-medium">User</th>
                  <th className="pb-2 text-left font-medium">Plan</th>
                  <th className="pb-2 text-left font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentUsers.map((u) => {
                  const sub    = subByUser[u.userId]
                  const status = sub?.status === 'trialing' ? 'trialing' : u.plan
                  return (
                    <tr key={u.id}>
                      <td className="py-2.5">
                        <Link href={`/admin/users/${u.id}`} className="font-medium text-white hover:text-blue-400 transition-colors">
                          {u.fullName ?? u.email}
                        </Link>
                        {u.fullName && <div className="text-xs text-gray-400">{u.email}</div>}
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={status} />
                      </td>
                      <td className="py-2.5 text-gray-400">{fmtDate(u.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
