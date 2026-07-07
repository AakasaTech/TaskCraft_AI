'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Gift, X } from 'lucide-react'
import { grantFreepassAction, revokeFreepassAction, extendTrialAction } from '@/app/actions/admin'
import type { Plan } from '@/lib/types'

const DURATIONS = [
  { label: '7 days',   days: 7 },
  { label: '30 days',  days: 30 },
  { label: '60 days',  days: 60 },
  { label: '90 days',  days: 90 },
  { label: '180 days', days: 180 },
  { label: '1 year',   days: 365 },
]

function addDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

interface Props {
  userId:               string
  subscriptionId:       string | null
  trialEndsAt:          string | null
  currentPlan:          string
  currentPlanExpiresAt: string | null
}

export function GrantFreepassDialog({
  userId,
  subscriptionId,
  trialEndsAt,
  currentPlan,
  currentPlanExpiresAt,
}: Props) {
  const [open,  setOpen]  = useState(false)
  const [plan,  setPlan]  = useState<Plan>('solo')
  const [until, setUntil] = useState(addDays(30))
  const [permanent, setPermanent] = useState(false)
  const [isPending, startTransition] = useTransition()

  const hasFreepass = currentPlanExpiresAt !== null && currentPlan !== 'free'
  const hasTrial    = !!(trialEndsAt && new Date(trialEndsAt) > new Date())

  function handleGrant() {
    startTransition(async () => {
      const durationDays = permanent ? null : Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / 86_400_000))
      const r = await grantFreepassAction(userId, plan, durationDays)
      if (r.error) { toast.error(r.error); return }
      toast.success('Free pass granted.')
      setOpen(false)
    })
  }

  function handleRevoke() {
    startTransition(async () => {
      const r = await revokeFreepassAction(userId)
      if (r.error) { toast.error(r.error); return }
      toast.success('Free pass revoked.')
    })
  }

  function handleExtendTrial(days: number) {
    if (!subscriptionId) { toast.error('No subscription found.'); return }
    startTransition(async () => {
      const r = await extendTrialAction(subscriptionId, days)
      if (r.error) { toast.error(r.error); return }
      toast.success(`Trial extended by ${days} days.`)
    })
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500"
        >
          <Gift className="h-3.5 w-3.5" />
          {hasFreepass ? 'Update free pass' : 'Grant free pass'}
        </button>
        {hasFreepass && (
          <button
            onClick={handleRevoke}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            Revoke
          </button>
        )}
        {hasTrial && (
          <button
            onClick={() => handleExtendTrial(30)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            +30d trial
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Grant Free Pass</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-300">Plan</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as Plan)}
                  className="w-full rounded-lg border border-white/20 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="solo">Solo</option>
                  <option value="team">Team</option>
                </select>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-300">Duration</label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permanent}
                      onChange={(e) => setPermanent(e.target.checked)}
                      className="rounded"
                    />
                    Permanent
                  </label>
                </div>
                {!permanent && (
                  <>
                    <div className="grid grid-cols-3 gap-1.5">
                      {DURATIONS.map(({ label, days }) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setUntil(addDays(days))}
                          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            until === addDays(days)
                              ? 'bg-violet-600 text-white'
                              : 'border border-white/20 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2">
                      <label className="mb-1 block text-xs text-gray-500">Or pick a date</label>
                      <input
                        type="date"
                        value={until}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setUntil(e.target.value)}
                        className="w-full rounded-lg border border-white/20 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-300">
                This user will get <strong>{plan}</strong>-tier access{' '}
                {permanent
                  ? 'permanently'
                  : <>until <strong>{new Date(until).toLocaleDateString('en-US', { dateStyle: 'medium' })}</strong></>
                }.
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-white/20 py-2 text-sm text-gray-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleGrant}
                disabled={isPending}
                className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Grant access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
