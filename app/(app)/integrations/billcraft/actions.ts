'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BillCraftService } from '@/lib/billcraft';

async function getWorkspaceId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .single();
  return data?.workspace_id ?? null;
}

export async function saveBillCraftSettings(formData: {
  api_key: string;
  api_url: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return { error: 'No workspace found' };

  const config = {
    api_key: formData.api_key.trim(),
    api_url: formData.api_url.trim() || 'https://billcraft.aakasa.dev/api',
  };

  const { error } = await supabase
    .from('integration_settings')
    .upsert(
      {
        workspace_id:     workspaceId,
        integration_type: 'billcraft',
        enabled:          !!config.api_key,
        config,
        created_by:       user.id,
      },
      { onConflict: 'workspace_id,integration_type' },
    );

  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function testBillCraftConnection(apiKey?: string, apiUrl?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  // If called with explicit values (pre-save test), use those directly
  if (apiKey) {
    const svc = new BillCraftService(apiKey, apiUrl || 'https://billcraft.aakasa.dev/api');
    return svc.testConnection();
  }

  // Otherwise fall back to saved settings
  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return { error: 'No workspace found' };

  const { data: settings } = await supabase
    .from('integration_settings')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'billcraft')
    .single();

  if (!settings) return { error: 'BillCraft not configured' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new BillCraftService(cfg.api_key ?? '', cfg.api_url);
  return svc.testConnection();
}

export async function syncBillCraftClients() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return { error: 'No workspace found' };

  const { data: settings } = await supabase
    .from('integration_settings')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'billcraft')
    .single();

  if (!settings) return { error: 'BillCraft not configured' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new BillCraftService(cfg.api_key ?? '', cfg.api_url);

  try {
    const clients = await svc.getClients();

    // Update last sync timestamp in config
    await supabase
      .from('integration_settings')
      .update({
        config: { ...cfg, last_client_sync_at: new Date().toISOString() },
      })
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'billcraft');

    return { data: { count: clients.length } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sync failed' };
  }
}

export async function syncBillCraftProjects() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return { error: 'No workspace found' };

  const { data: settings } = await supabase
    .from('integration_settings')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'billcraft')
    .single();

  if (!settings) return { error: 'BillCraft not configured' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new BillCraftService(cfg.api_key ?? '', cfg.api_url);

  try {
    const projects = await svc.getProjects();

    await supabase
      .from('integration_settings')
      .update({
        config: { ...cfg, last_project_sync_at: new Date().toISOString() },
      })
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'billcraft');

    return { data: { count: projects.length } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sync failed' };
  }
}

export async function disconnectBillCraft() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return { error: 'No workspace found' };

  const { error } = await supabase
    .from('integration_settings')
    .update({ enabled: false, config: {} })
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'billcraft');

  if (error) return { error: error.message };
  return { data: { ok: true } };
}
