import type { NotificationType } from '@/lib/types';

export interface SendEmailParams {
  to:      string;
  subject: string;
  html:    string;
}

/**
 * Send a transactional email (password reset, verification, etc.).
 * Currently stubbed — wire up Resend, SendGrid, or similar to ship real emails.
 */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[email:send]', { to, subject, html });
  }
  // TODO: implement real email delivery
}

export interface EmailNotificationParams {
  to:      string;
  type:    NotificationType;
  title:   string;
  body?:   string;
  link?:   string;
  appUrl?: string;
}

/**
 * Send a notification email.
 * Currently stubbed — wire up Resend, SendGrid, or similar to ship real emails.
 *
 * Suggested integration:
 *   import { Resend } from 'resend';
 *   const resend = new Resend(process.env.RESEND_API_KEY);
 *   await resend.emails.send({ from: 'noreply@taskcraft.ai', to, subject: title, html: ... });
 */
export async function sendNotificationEmail({
  to,
  type,
  title,
  body,
  link,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://taskcraft.aakasa.dev',
}: EmailNotificationParams): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[email:notification]', { to, type, title, body, link: link ? `${appUrl}${link}` : undefined });
  }
  // TODO: implement real email delivery
}

/**
 * Returns whether a notification type maps to an email preference key.
 * Used to check the user's notification prefs before sending email.
 */
export function getEmailPrefKey(type: NotificationType): string | null {
  const MAP: Partial<Record<NotificationType, string>> = {
    task_assigned:               'task_assigned',
    task_due_soon:               'task_due',
    task_overdue:                'task_due',
    comment_added:               'project_updates',
    project_deadline_near:       'project_updates',
    invoice_sync_completed:      'billing',
    support_ticket_task_created: 'project_updates',
    team_invitation_received:    'task_assigned', // always-important, reuse slot
    timer_running_long:           undefined,       // in-app only
  };
  return MAP[type] ?? null;
}
