import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { GrantFreepassForm } from './_components/GrantFreepassForm'
import { RevokeFreepassButton } from './_components/RevokeFreepassButton'
import type { Plan } from '@/lib/types'

export const metadata: Metadata = { title: 'Free Pass — Admin', robots: 'noindex, nofollow' }

interface PaidUserRow {
  id:              string
  email:           string
  full_name:       string | null
  plan:            Plan
  plan_expires_at: string | null
}

function expiryLabel(expiresAt: string | null): { text: string; color: string } {
  if (!expiresAt) return { text: 'Permanent', color: 'text-emerald-400' }
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff < 0) return { text: 'Expired', color: 'text-red-400' }
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  const date = new Date(expiresAt).toLocaleDateString('en-US', { dateStyle: 'medium' })
  return {
    text:  `${date} (${days}d)`,
    color: days < 14 ? 'text-amber-400' : 'text-gray-400',
  }
}

export default async function FreepassPage() {
  const db = createAdminClient()

  const { data: paidUsers } = await db
    .from('profiles')
    .select('id, email, full_name, plan, plan_expires_at')
    .neq('plan', 'free')
    .order('plan_expires_at', { ascending: true, nullsFirst: false })
    .limit(200)

  const rows = (paidUsers ?? []) as PaidUserRow[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Free Pass</h1>
        <p className="mt-1 text-sm text-gray-400">Grant complimentary paid access to users</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Grant form */}
        <GrantFreepassForm />

        {/* Active paid users */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Paid users</h2>
            <span className="text-xs text-gray-500">{rows.length} total</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-gray-900">
            {rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gray-500">No paid users yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">User</th>
                    <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                    <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Expires</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((u) => {
                    const expiry = expiryLabel(u.plan_expires_at)
                    return (
                      <tr key={u.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-2.5">
                          <Link href={`/admin/users/${u.id}`} className="font-medium text-white hover:text-blue-400 transition-colors">
                            {u.full_name ?? u.email}
                          </Link>
                          {u.full_name && <p className="text-[11px] text-gray-500">{u.email}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                            u.plan === 'team' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {u.plan}
                          </span>
                        </td>
                        <td className="hidden px-4 py-2.5 sm:table-cell">
                          <span className={`text-xs ${expiry.color}`}>{expiry.text}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <RevokeFreepassButton userId={u.id} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
