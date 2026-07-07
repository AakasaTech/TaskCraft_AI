import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { ToggleActiveButton } from './ToggleActiveButton'
import { ChevronRight } from 'lucide-react'

export const metadata: Metadata = { title: 'Users — Admin', robots: 'noindex, nofollow' }

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' })
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${color}`}>{label}</span>
}

interface ProfileRow {
  id:              string
  email:           string
  full_name:       string | null
  plan:            string
  plan_expires_at: string | null
  is_admin:        boolean
  created_at:      string
}

export default async function AdminUsersPage() {
  const db = createAdminClient()

  const [profilesRes, authRes] = await Promise.all([
    db.from('profiles')
      .select('id, email, full_name, plan, plan_expires_at, is_admin, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ])

  const profiles  = (profilesRes.data ?? []) as ProfileRow[]
  const authUsers = authRes.data?.users ?? []

  const now    = Date.now()
  const banMap = new Map<string, boolean>(
    authUsers.map((au) => [
      au.id,
      !!(au.banned_until && new Date(au.banned_until).getTime() > now),
    ]),
  )

  const activeCount    = profiles.filter((u) => !banMap.get(u.id)).length
  const suspendedCount = profiles.filter((u) => banMap.get(u.id)).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="mt-1 text-sm text-gray-400">
          {profiles.length} total · {activeCount} active · {suspendedCount} suspended
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-gray-900">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10">
            <tr className="text-xs text-gray-500">
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Plan</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Joined</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {profiles.map((u) => {
              const isBanned = banMap.get(u.id) ?? false
              return (
                <tr key={u.id} className={`hover:bg-white/5 transition-colors ${isBanned ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">
                      {u.full_name || '—'}
                      {u.is_admin && (
                        <span className="ml-1.5 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-400">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>

                  <td className="px-4 py-3">
                    <Badge
                      label={u.plan}
                      color={
                        u.plan === 'team' ? 'bg-purple-500/20 text-purple-400' :
                        u.plan === 'solo' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }
                    />
                    {u.plan_expires_at && (
                      <div className="mt-0.5 text-[10px] text-gray-500">until {fmtDate(u.plan_expires_at)}</div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Badge
                      label={isBanned ? 'suspended' : 'active'}
                      color={isBanned ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}
                    />
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(u.created_at)}</td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ToggleActiveButton userId={u.id} isBanned={isBanned} />
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        Manage <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
