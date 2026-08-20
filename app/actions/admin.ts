'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth/helpers'
import type { Plan } from '@/lib/types'

type Result = { error?: string; success?: boolean }

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function verifyAdmin(): Promise<void> {
  const user = await getAuthUser()
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
    await prisma.user.update({
      where: { id: userId },
      data:  { bannedUntil: shouldBan ? new Date(Date.now() + 87_660 * 60 * 60 * 1000) : null },
    })
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
    const profile = await prisma.profile.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
      select: { id: true, fullName: true, plan: true, planExpiresAt: true },
    })
    if (!profile) return null
    return {
      id:              profile.id,
      full_name:       profile.fullName,
      plan:            profile.plan as Plan,
      plan_expires_at: profile.planExpiresAt ? profile.planExpiresAt.toISOString() : null,
    }
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
    const expiresAt = durationDays
      ? new Date(Date.now() + durationDays * 86_400_000)
      : null
    await prisma.profile.update({
      where: { id: userId },
      data:  { plan, planExpiresAt: expiresAt },
    })
    revalidatePath('/admin/freepass')
    revalidatePath('/admin/users')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed' }
  }
}

// ─── Extend trial ─────────────────────────────────────────────────────────────

export async function extendTrialAction(subscriptionId: string, days: number): Promise<Result> {
  try {
    await verifyAdmin()
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { trialEndsAt: true },
    })
    const base = sub?.trialEndsAt && sub.trialEndsAt > new Date()
      ? new Date(sub.trialEndsAt)
      : new Date()
    base.setDate(base.getDate() + days)
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data:  { trialEndsAt: base },
    })
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
    await prisma.profile.update({
      where: { id: userId },
      data:  { plan: 'free', planExpiresAt: null },
    })
    revalidatePath('/admin/freepass')
    revalidatePath('/admin/users')
    return { success: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed' }
  }
}
