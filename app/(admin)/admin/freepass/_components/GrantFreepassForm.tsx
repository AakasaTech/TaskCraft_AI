'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Gift, Loader2, Search } from 'lucide-react'
import { lookupUserByEmailAction, grantFreepassAction } from '@/app/actions/admin'
import type { Plan } from '@/lib/types'

const DURATIONS = [
  { label: '30 days',   days: 30 },
  { label: '90 days',   days: 90 },
  { label: '1 year',    days: 365 },
  { label: 'Permanent', days: null },
] as const

type FoundUser = {
  id:              string
  full_name:       string | null
  plan:            Plan
  plan_expires_at: string | null
}

export function GrantFreepassForm() {
  const [email,     setEmail]     = useState('')
  const [plan,      setPlan]      = useState<Plan>('solo')
  const [duration,  setDuration]  = useState<number | null>(30)
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setFoundUser(null)
    startTransition(async () => {
      const user = await lookupUserByEmailAction(email.trim())
      if (!user) { toast.error('No user found with that email.'); return }
      setFoundUser(user)
    })
  }

  function handleGrant() {
    if (!foundUser) return
    startTransition(async () => {
      const r = await grantFreepassAction(foundUser.id, plan, plan === 'free' ? null : duration)
      if (r.error) { toast.error(r.error); return }
      toast.success(
        plan === 'free'
          ? 'User reverted to Free plan.'
          : `${plan} plan granted${duration ? ` for ${duration} days` : ' permanently'}.`,
      )
      setEmail('')
      setFoundUser(null)
      setPlan('solo')
      setDuration(30)
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-gray-900 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Gift className="h-4 w-4 text-violet-400" />
        <h2 className="text-sm font-semibold text-white">Grant Plan Access</h2>
      </div>
      <p className="text-xs text-gray-400">Override a user&apos;s plan without requiring payment.</p>

      {/* Step 1: Find user */}
      <form onSubmit={handleLookup} className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-300">User email</label>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFoundUser(null) }}
            disabled={isPending}
            className="flex-1 rounded-lg border border-white/20 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPending || !email.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {isPending && !foundUser
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Search className="h-3.5 w-3.5" />}
            Find
          </button>
        </div>
      </form>

      {/* Step 2: Configure grant */}
      {foundUser && (
        <>
          <div className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-sm">
            <p className="font-medium text-white">{foundUser.full_name ?? email}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              Current plan: <span className="font-semibold capitalize text-gray-300">{foundUser.plan}</span>
              {foundUser.plan_expires_at && (
                <> · expires {new Date(foundUser.plan_expires_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</>
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-300">Plan to grant</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Plan)}
              className="w-full rounded-lg border border-white/20 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="solo">Solo</option>
              <option value="team">Team</option>
              <option value="free">Revert to Free</option>
            </select>
          </div>

          {plan !== 'free' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-300">Duration</label>
              <div className="grid grid-cols-2 gap-1.5">
                {DURATIONS.map(({ label, days }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setDuration(days)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      duration === days
                        ? 'bg-violet-600 text-white'
                        : 'border border-white/20 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleGrant}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Gift className="h-4 w-4" />}
            {plan === 'free' ? 'Revert to Free' : `Grant ${plan} plan`}
          </button>
        </>
      )}
    </div>
  )
}
