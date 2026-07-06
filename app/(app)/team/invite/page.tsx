import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { acceptInvitation } from '../actions';

export const metadata: Metadata = { title: 'Accept Invitation' };

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="rounded-2xl border border-border bg-card p-8 max-w-sm w-full">
          <p className="text-4xl mb-3">🔗</p>
          <h1 className="text-lg font-bold mb-1">Invalid Invitation</h1>
          <p className="text-sm text-muted-foreground">This invitation link is missing or malformed.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Must be logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/team/invite?token=${token}`);

  const result = await acceptInvitation(token);

  if (result.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="rounded-2xl border border-border bg-card p-8 max-w-sm w-full">
          <p className="text-4xl mb-3">❌</p>
          <h1 className="text-lg font-bold mb-1">Invitation Failed</h1>
          <p className="text-sm text-muted-foreground">{result.error}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Redirect to dashboard on success
  redirect('/dashboard');
}
