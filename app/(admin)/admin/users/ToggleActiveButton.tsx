'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { toggleUserActiveAction } from '@/app/actions/admin';

interface Props {
  userId:   string;
  isBanned: boolean;
}

export function ToggleActiveButton({ userId, isBanned }: Props) {
  const [isPending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const r = await toggleUserActiveAction(userId, !isBanned);
      if (r.error) { toast.error(r.error); return; }
      toast.success(isBanned ? 'User enabled.' : 'User suspended.');
    });
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        isBanned
          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50'
          : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'
      }`}
    >
      {isPending ? '…' : isBanned ? 'Enable' : 'Suspend'}
    </button>
  );
}
