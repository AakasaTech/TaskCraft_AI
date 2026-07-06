'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { revokeFreepassAction } from '@/app/actions/admin';

export function RevokeFreepassButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();

  function handle() {
    if (!confirm('Revert this user to the Free plan?')) return;
    startTransition(async () => {
      const r = await revokeFreepassAction(userId);
      if (r.error) { toast.error(r.error); return; }
      toast.success('Plan reverted to Free.');
    });
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      title="Revoke — revert to Free"
      className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors disabled:opacity-50"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}
