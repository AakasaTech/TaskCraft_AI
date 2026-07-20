'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const IDLE_MS = 30 * 60 * 1000;
const WARN_MS =  2 * 60 * 1000;

export function SessionTimeout() {
  const router   = useRouter();
  const [warning,   setWarning]   = useState(false);
  const [countdown, setCountdown] = useState(Math.round(WARN_MS / 1000));
  const idleRef  = useRef<ReturnType<typeof setTimeout>>();
  const warnRef  = useRef<ReturnType<typeof setTimeout>>();
  const tickRef  = useRef<ReturnType<typeof setInterval>>();

  const signOut = useCallback(async () => {
    clearTimeout(idleRef.current);
    clearTimeout(warnRef.current);
    clearInterval(tickRef.current);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }, [router]);

  const resetTimers = useCallback(() => {
    setWarning(false);
    setCountdown(Math.round(WARN_MS / 1000));
    clearTimeout(idleRef.current);
    clearTimeout(warnRef.current);
    clearInterval(tickRef.current);

    idleRef.current = setTimeout(() => {
      setWarning(true);
      let remaining = Math.round(WARN_MS / 1000);
      setCountdown(remaining);
      tickRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) clearInterval(tickRef.current);
      }, 1000);
      warnRef.current = setTimeout(signOut, WARN_MS);
    }, IDLE_MS);
  }, [signOut]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;
    const handle = () => resetTimers();
    events.forEach((e) => window.addEventListener(e, handle, { passive: true }));
    resetTimers();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handle));
      clearTimeout(idleRef.current);
      clearTimeout(warnRef.current);
      clearInterval(tickRef.current);
    };
  }, [resetTimers]);

  if (!warning) return null;

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${countdown}s`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl mx-4">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Session expiring soon</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You've been inactive. You'll be signed out in{' '}
              <span className="font-mono font-semibold text-foreground">{display}</span>.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={signOut}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Sign out
            </button>
            <button
              onClick={resetTimers}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Stay logged in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
