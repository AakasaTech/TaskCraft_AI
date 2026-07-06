'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Plan } from '@/lib/types'

type Result = { error?: string; success?: boolean }

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function verifyAdmin(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!user?.email || !adminEmails.includes(user.email.toLowerCase())) {
    throw new Error('Unauthorized')
  }
}

// ─── Toggle user active / suspended ──────────────────────────────────────────

export async function toggleUserActiveAction(userId: string, shouldBan: boolean): Promise<Result> {
  try {
    await verifyAdmin()
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: shouldBan ? '87660h' : 'none',
    })
    if (error) return { error: error.message }
    revalidatePath('/admin/users')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed' }
  }
}

// ─── Look up user by email ────────────────────────────────────────────────────

export async function lookupUserByEmailAction(email: string): Promise<{
  id: string;
  full_name: string | null;
  plan: Plan;
  plan_expires_at: string | null;
} | null> {
  try {
    await verifyAdmin()
    const admin = createAdminClient()
    const { data } = await admin
      .from('profiles')
      .select('id, full_name, plan, plan_expires_at')
      .ilike('email', email.trim())
      .maybeSingle()
    return data as { id: string; full_name: string | null; plan: Plan; plan_expires_at: string | null } | null
  } catch {
    return null
  }
}

// ─── Grant free pass ──────────────────────────────────────────────────────────

export async function grantFreepassAction(
  userId:       string,
  plan:         Plan,
  durationDays: number | null,  // null = permanent
): Promise<Result> {
  try {
    await verifyAdmin()
    const admin = createAdminClient()
    const expiresAt = durationDays
      ? new Date(Date.now() + durationDays * 86_400_000).toISOString()
      : null
    const { error } = await admin
      .from('profiles')
      .update({ plan, plan_expires_at: expiresAt })
      .eq('id', userId)
    if (error) return { error: error.message }
    revalidatePath('/admin/freepass')
    revalidatePath('/admin/users')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed' }
  }
}

// ─── Revoke free pass ─────────────────────────────────────────────────────────

export async function revokeFreepassAction(userId: string): Promise<Result> {
  try {
    await verifyAdmin()
    const admin = createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({ plan: 'free', plan_expires_at: null })
      .eq('id', userId)
    if (error) return { error: error.message }
    revalidatePath('/admin/freepass')
    revalidatePath('/admin/users')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed' }
  }
}
