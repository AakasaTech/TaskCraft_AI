'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resetPasswordWithToken } from '../forgot-password/actions';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error('Invalid or missing reset token.');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setLoading(true);

    const res = await resetPasswordWithToken(token, password);
    if (res.error) {
      toast.error(res.error);
      setLoading(false);
      return;
    }

    toast.success('Password updated! Please sign in with your new password.');
    router.push('/login');
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">Set new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              className="pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="tc-btn-primary w-full"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Update password
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}
