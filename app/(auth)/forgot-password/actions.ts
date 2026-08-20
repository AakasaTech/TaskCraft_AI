'use server';

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { sendEmail } from '@/lib/email';

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) return { error: 'Email is required.' };

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return { success: true };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

  try {
    await sendEmail({
      to: normalizedEmail,
      subject: 'Reset your TaskCraft AI password',
      html: `
        <p>Hello,</p>
        <p>You requested a password reset for your TaskCraft AI account.</p>
        <p><a href="${resetLink}" style="padding:10px 16px; background:#4f46e5; color:#ffffff; text-decoration:none; border-radius:6px;">Reset Password</a></p>
        <p>Or copy this link: ${resetLink}</p>
        <p>This link expires in 1 hour. If you did not request this, please ignore this email.</p>
      `,
    });
  } catch (err) {
    console.error('Failed to send reset email:', err);
  }

  return { success: true };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  if (!token || !newPassword) {
    return { error: 'Token and new password are required.' };
  }

  if (newPassword.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
    return { error: 'Invalid or expired password reset link. Please request a new one.' };
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRecord.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}
