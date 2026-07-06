'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Gift, Loader2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { lookupUserByEmailAction, grantFreepassAction } from '@/app/actions/admin';
import type { Plan } from '@/lib/types';

const DURATIONS = [
  { label: '30 days',   days: 30  },
  { label: '90 days',   days: 90  },
  { label: '1 year',    days: 365 },
  { label: 'Permanent', days: null },
] as const;

type FoundUser = {
  id:              string;
  full_name:       string | null;
  plan:            Plan;
  plan_expires_at: string | null;
};

export function GrantFreepassForm() {
  const [email,     setEmail]     = useState('');
  const [plan,      setPlan]      = useState<Plan>('solo');
  const [duration,  setDuration]  = useState<number | null>(30);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setFoundUser(null);
    startTransition(async () => {
      const user = await lookupUserByEmailAction(email.trim());
      if (!user) {
        toast.error('No user found with that email.');
        return;
      }
      setFoundUser(user);
    });
  }

  function handleGrant() {
    if (!foundUser) return;
    startTransition(async () => {
      const r = await grantFreepassAction(foundUser.id, plan, plan === 'free' ? null : duration);
      if (r.error) { toast.error(r.error); return; }
      toast.success(
        plan === 'free'
          ? 'User reverted to Free plan.'
          : `${plan} plan granted${duration ? ` for ${duration} days` : ' permanently'}.`,
      );
      setEmail('');
      setFoundUser(null);
      setPlan('solo');
      setDuration(30);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Grant Plan Access</CardTitle>
        </div>
        <CardDescription>Override a user&apos;s plan without requiring payment.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Step 1: Find user */}
        <form onSubmit={handleLookup} className="space-y-1.5">
          <Label htmlFor="fp-email">User email</Label>
          <div className="flex gap-2">
            <Input
              id="fp-email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFoundUser(null); }}
              disabled={isPending}
            />
            <Button type="submit" variant="outline" size="sm" disabled={isPending || !email.trim()} className="gap-1.5 shrink-0">
              {isPending && !foundUser
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Search className="h-3.5 w-3.5" />}
              Find
            </Button>
          </div>
        </form>

        {/* Step 2: Configure grant */}
        {foundUser && (
          <>
            <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm">
              <p className="font-medium">{foundUser.full_name ?? email}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Current plan: <span className="font-semibold capitalize">{foundUser.plan}</span>
                {foundUser.plan_expires_at && (
                  <> · expires {new Date(foundUser.plan_expires_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}</>
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Plan to grant</Label>
              <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solo">Solo</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="free">Revert to Free</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {plan !== 'free' && (
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Select
                  value={duration === null ? 'null' : String(duration)}
                  onValueChange={(v) => setDuration(v === 'null' ? null : Number(v))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map(({ label, days }) => (
                      <SelectItem key={label} value={days === null ? 'null' : String(days)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button onClick={handleGrant} disabled={isPending} className="w-full gap-2">
              {isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Gift className="h-4 w-4" />}
              {plan === 'free' ? 'Revert to Free' : `Grant ${plan} plan`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
