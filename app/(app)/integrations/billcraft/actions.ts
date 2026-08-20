'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';
import { BillCraftService } from '@/lib/billcraft';

async function getContext() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: currentUser.profile.id, role: { in: ['owner', 'admin'] } },
    select: { workspaceId: true },
  });

  return { currentUser, workspaceId: member?.workspaceId ?? null };
}

export async function saveBillCraftSettings(formData: {
  api_key: string;
  api_url: string;
}) {
  const { currentUser, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  const config = {
    api_key: formData.api_key.trim(),
    api_url: formData.api_url.trim() || 'https://billcraft.aakasa.dev/api',
  };

  try {
    await prisma.integrationSetting.upsert({
      where: { workspaceId_integrationType: { workspaceId, integrationType: 'billcraft' } },
      create: {
        workspaceId,
        integrationType: 'billcraft',
        enabled:         !!config.api_key,
        config,
        createdById:     currentUser.profile.id,
      },
      update: {
        enabled: !!config.api_key,
        config,
      },
    });
    return { data: { ok: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save settings' };
  }
}

export async function testBillCraftConnection(apiKey?: string, apiUrl?: string) {
  const { workspaceId } = await getContext();

  // If called with explicit values (pre-save test), use those directly
  if (apiKey) {
    const svc = new BillCraftService(apiKey, apiUrl || 'https://billcraft.aakasa.dev/api');
    return svc.testConnection();
  }

  if (!workspaceId) return { error: 'No workspace found' };

  // Otherwise fall back to saved settings
  const settings = await prisma.integrationSetting.findUnique({
    where: { workspaceId_integrationType: { workspaceId, integrationType: 'billcraft' } },
    select: { config: true },
  });

  if (!settings) return { error: 'BillCraft not configured' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new BillCraftService(cfg.api_key ?? '', cfg.api_url);
  return svc.testConnection();
}

export async function syncBillCraftClients() {
  const { currentUser, workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  const settings = await prisma.integrationSetting.findUnique({
    where: { workspaceId_integrationType: { workspaceId, integrationType: 'billcraft' } },
    select: { config: true },
  });

  if (!settings) return { error: 'BillCraft not configured' };

  const cfg = settings.config as { api_key?: string; api_url?: string };
  const svc = new BillCraftService(cfg.api_key ?? '', cfg.api_url);

  try {
    const clients = await svc.getClients();

    for (const c of clients) {
      const existing = await prisma.client.findFirst({
        where: { workspaceId, billcraftClientId: c.id },
        select: { id: true },
      });

      if (existing) {
        await prisma.client.update({
          where: { id: existing.id },
          data:  { name: c.name, email: c.email ?? null, company: c.company ?? null },
        });
      } else {
        await prisma.client.create({
          data: {
            workspaceId,
            billcraftClientId: c.id,
            name:              c.name,
            email:             c.email ?? null,
            company:           c.company ?? null,
            createdById:       currentUser.profile.id,
          },
        });
      }
    }

    await prisma.integrationSetting.update({
      where: { workspaceId_integrationType: { workspaceId, integrationType: 'billcraft' } },
      data:  { config: { ...cfg, last_client_sync_at: new Date().toISOString() } },
    });

    return { data: { count: clients.length } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sync failed' };
  }
}

export async function disconnectBillCraft() {
  const { workspaceId } = await getContext();
  if (!workspaceId) return { error: 'No workspace found' };

  try {
    await prisma.integrationSetting.update({
      where: { workspaceId_integrationType: { workspaceId, integrationType: 'billcraft' } },
      data:  { enabled: false, config: {} },
    });
    return { data: { ok: true } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to disconnect' };
  }
}
