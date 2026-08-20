'use server';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { slugify } from '@/lib/utils';

export async function registerUser({
  email,
  password,
  fullName,
  plan = 'free',
}: {
  email: string;
  password: string;
  fullName: string;
  plan?: string;
}) {
  const normalizedEmail = email.toLowerCase().trim();

  if (!normalizedEmail || !password) {
    return { error: 'Email and password are required.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return { error: 'An account with this email already exists.' };
  }

  const passwordHash = await hashPassword(password);
  const orgName = `${fullName || 'My'}'s Workspace`;
  const slug = `${slugify(orgName)}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
        },
      });

      const profile = await tx.profile.create({
        data: {
          userId: user.id,
          email: normalizedEmail,
          fullName: fullName || normalizedEmail.split('@')[0],
          plan,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: orgName,
          slug,
          ownerId: profile.id,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: profile.id,
          role: 'owner',
        },
      });

      await tx.subscription.create({
        data: {
          userId: user.id,
          planId: plan,
          status: 'active',
        },
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Registration transaction error:', error);
    return { error: 'Failed to create account. Please try again.' };
  }
}
