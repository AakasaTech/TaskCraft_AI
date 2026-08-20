'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { generateRawKey } from '@/lib/api-auth';
import { randomBytes } from 'node:crypto';
import type { ApiScope, WebhookEventType } from '@/lib/types';

// ── API Keys ──────────────────────────────────────────────────────────────────

export async function createApiKey(name: string, scopes: ApiScope[]) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized.' };

  if (!['owner', 'admin'].includes(currentUser.membership.role)) {
    return { error: 'Insufficient permissions.' };
  }

  if (!name.trim())   return { error: 'Name is required.' };
  if (!scopes.length) return { error: 'At least one scope is required.' };

  const { key, hash, prefix } = generateRawKey();
  const workspaceId = currentUser.workspace.id;
  const uid = currentUser.profile.id;

  try {
    const apiKey = await prisma.apiKey.create({
      data: {
        workspaceId,
        userId:    uid,
        name:      name.trim(),
        keyHash:   hash,
        keyPrefix: prefix,
        scopes,
      },
      select: {
        id:        true,
        name:      true,
        keyPrefix: true,
        scopes:    true,
        createdAt: true,
      },
    });

    revalidatePath('/settings/api');
    return {
      data: {
        id:         apiKey.id,
        name:       apiKey.name,
        key_prefix: apiKey.keyPrefix,
        scopes:     apiKey.scopes,
        created_at: apiKey.createdAt.toISOString(),
        key,
      },
    };
  } catch (err) {
    console.error('Error creating API key:', err);
    return { error: 'Failed to create API key.' };
  }
}

export async function revokeApiKey(keyId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized.' };

  if (!['owner', 'admin'].includes(currentUser.membership.role)) {
    return { error: 'Insufficient permissions.' };
  }

  try {
    await prisma.apiKey.updateMany({
      where: {
        id:          keyId,
        workspaceId: currentUser.workspace.id,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    revalidatePath('/settings/api');
    return { success: true };
  } catch (err) {
    console.error('Error revoking API key:', err);
    return { error: 'Failed to revoke API key.' };
  }
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

const VALID_EVENTS: WebhookEventType[] = [
  'task.created', 'task.updated', 'task.completed',
  'project.created', 'project.completed',
  'time_entry.created', 'invoice.created', 'support_ticket.linked',
];

export async function createWebhook(params: {
  name:   string;
  url:    string;
  events: WebhookEventType[];
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized.' };

  if (!['owner', 'admin'].includes(currentUser.membership.role)) {
    return { error: 'Insufficient permissions.' };
  }

  if (!params.url.trim())    return { error: 'URL is required.' };
  if (!params.events.length) return { error: 'Select at least one event.' };

  try { new URL(params.url); } catch { return { error: 'URL must be a valid HTTPS URL.' }; }

  const invalid = params.events.filter((e) => !VALID_EVENTS.includes(e));
  if (invalid.length) return { error: `Invalid event types: ${invalid.join(', ')}` };

  const secret = randomBytes(24).toString('hex');
  const workspaceId = currentUser.workspace.id;
  const uid = currentUser.profile.id;

  try {
    const webhook = await prisma.webhook.create({
      data: {
        workspaceId,
        userId: uid,
        name:   params.name.trim() || params.url,
        url:    params.url.trim(),
        secret,
        events: params.events,
      },
      select: {
        id:        true,
        name:      true,
        url:       true,
        events:    true,
        active:    true,
        createdAt: true,
      },
    });

    revalidatePath('/settings/api');
    return {
      data: {
        id:         webhook.id,
        name:       webhook.name,
        url:        webhook.url,
        events:     webhook.events,
        active:     webhook.active,
        created_at: webhook.createdAt.toISOString(),
        secret,
      },
    };
  } catch (err) {
    console.error('Error creating webhook:', err);
    return { error: 'Failed to create webhook.' };
  }
}

export async function deleteWebhook(webhookId: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized.' };

  if (!['owner', 'admin'].includes(currentUser.membership.role)) {
    return { error: 'Insufficient permissions.' };
  }

  try {
    await prisma.webhook.deleteMany({
      where: {
        id:          webhookId,
        workspaceId: currentUser.workspace.id,
      },
    });

    revalidatePath('/settings/api');
    return { success: true };
  } catch (err) {
    console.error('Error deleting webhook:', err);
    return { error: 'Failed to delete webhook.' };
  }
}

export async function toggleWebhook(webhookId: string, active: boolean) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized.' };

  if (!['owner', 'admin'].includes(currentUser.membership.role)) {
    return { error: 'Insufficient permissions.' };
  }

  try {
    await prisma.webhook.updateMany({
      where: {
        id:          webhookId,
        workspaceId: currentUser.workspace.id,
      },
      data: { active },
    });

    revalidatePath('/settings/api');
    return { success: true };
  } catch (err) {
    console.error('Error toggling webhook:', err);
    return { error: 'Failed to update webhook.' };
  }
}
