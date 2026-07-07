'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { toggleUserActiveAction } from '@/app/actions/admin'

export function ToggleActiveButton({ userId, isBanned }: { userId: string; isBanned: boolean }) {
  const [isPending, startTransition] = useTransition()

  function handle() {
    startTransition(async () => {
      const r = await toggleUserActiveAction(userId, !isBanned)
      if (r.error) { toast.error(r.error); return }
      toast.success(isBanned ? 'User enabled.' : 'User suspended.')
    })
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        isBanned
          ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
          : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
      }`}
    >
      {isPending ? '…' : isBanned ? 'Enable' : 'Suspend'}
    </button>
  )
}
