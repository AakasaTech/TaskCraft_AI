'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateRawKey } from '@/lib/api-auth';
import { randomBytes } from 'node:crypto';
import type { ApiScope, WebhookEventType } from '@/lib/types';

async function getMemberAndWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!member || !['owner', 'admin'].includes(member.role)) return null;
  return { userId: user.id, workspaceId: member.workspace_id };
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export async function createApiKey(name: string, scopes: ApiScope[]) {
  const ctx = await getMemberAndWorkspace();
  if (!ctx) return { error: 'Unauthorized or insufficient permissions.' };

  if (!name.trim())    return { error: 'Name is required.' };
  if (!scopes.length)  return { error: 'At least one scope is required.' };

  const { key, hash, prefix } = generateRawKey();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('api_keys')
    .insert({
      workspace_id: ctx.workspaceId,
      user_id:      ctx.userId,
      name:         name.trim(),
      key_hash:     hash,
      key_prefix:   prefix,
      scopes,
    })
    .select('id, name, key_prefix, scopes, created_at')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/settings/api');
  return { data: { ...data, key } }; // key returned ONCE
}

export async function revokeApiKey(keyId: string) {
  const ctx = await getMemberAndWorkspace();
  if (!ctx) return { error: 'Unauthorized.' };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('api_keys')
    .select('workspace_id')
    .eq('id', keyId)
    .maybeSingle();

  if (!existing || existing.workspace_id !== ctx.workspaceId) {
    return { error: 'API key not found.' };
  }

  const { error } = await admin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId);

  if (error) return { error: error.message };

  revalidatePath('/settings/api');
  return { success: true };
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
  const ctx = await getMemberAndWorkspace();
  if (!ctx) return { error: 'Unauthorized.' };

  if (!params.url.trim())     return { error: 'URL is required.' };
  if (!params.events.length)  return { error: 'Select at least one event.' };

  try { new URL(params.url); } catch { return { error: 'URL must be a valid HTTPS URL.' }; }

  const invalid = params.events.filter((e) => !VALID_EVENTS.includes(e));
  if (invalid.length) return { error: `Invalid event types: ${invalid.join(', ')}` };

  const secret = randomBytes(24).toString('hex');
  const admin  = createAdminClient();

  const { data, error } = await admin
    .from('webhooks')
    .insert({
      workspace_id: ctx.workspaceId,
      user_id:      ctx.userId,
      name:         params.name.trim() || params.url,
      url:          params.url.trim(),
      secret,
      events:       params.events,
    })
    .select('id, name, url, events, active, created_at')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/settings/api');
  return { data: { ...data, secret } }; // secret returned ONCE
}

export async function deleteWebhook(webhookId: string) {
  const ctx = await getMemberAndWorkspace();
  if (!ctx) return { error: 'Unauthorized.' };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('webhooks')
    .select('workspace_id')
    .eq('id', webhookId)
    .maybeSingle();

  if (!existing || existing.workspace_id !== ctx.workspaceId) {
    return { error: 'Webhook not found.' };
  }

  const { error } = await admin.from('webhooks').delete().eq('id', webhookId);
  if (error) return { error: error.message };

  revalidatePath('/settings/api');
  return { success: true };
}

export async function toggleWebhook(webhookId: string, active: boolean) {
  const ctx = await getMemberAndWorkspace();
  if (!ctx) return { error: 'Unauthorized.' };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('webhooks')
    .select('workspace_id')
    .eq('id', webhookId)
    .maybeSingle();

  if (!existing || existing.workspace_id !== ctx.workspaceId) {
    return { error: 'Webhook not found.' };
  }

  const { error } = await admin.from('webhooks').update({ active }).eq('id', webhookId);
  if (error) return { error: error.message };

  revalidatePath('/settings/api');
  return { success: true };
}
