'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import type { CreateClientInput, UpdateClientInput } from '@/lib/types';

export async function createClientRecord(input: CreateClientInput) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    const client = await prisma.client.create({
      data: {
        workspaceId: currentUser.workspace.id,
        createdById: currentUser.profile.id,
        name:        input.name,
        email:       input.email || null,
        phone:       input.phone || null,
        company:     input.company || null,
        website:     input.website || null,
        address:     (input.address as any) ?? {},
        notes:       input.notes || null,
      },
    });

    revalidatePath('/clients');
    return { id: client.id };
  } catch (err) {
    console.error('Error creating client:', err);
    return { error: 'Failed to create client.' };
  }
}

export async function updateClientRecord(id: string, input: UpdateClientInput) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  const data: Record<string, unknown> = {};
  if (input.name    !== undefined) data.name    = input.name;
  if (input.email   !== undefined) data.email   = input.email || null;
  if (input.phone   !== undefined) data.phone   = input.phone || null;
  if (input.company !== undefined) data.company = input.company || null;
  if (input.website !== undefined) data.website = input.website || null;
  if (input.address !== undefined) data.address = input.address;
  if (input.notes   !== undefined) data.notes   = input.notes || null;

  try {
    await prisma.client.updateMany({
      where: {
        id,
        workspaceId: currentUser.workspace.id,
      },
      data,
    });

    revalidatePath('/clients');
    revalidatePath(`/clients/${id}`);
    return {};
  } catch (err) {
    console.error('Error updating client:', err);
    return { error: 'Failed to update client.' };
  }
}

export async function deleteClientRecord(id: string) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { error: 'Unauthorized' };

  try {
    await prisma.client.deleteMany({
      where: {
        id,
        workspaceId: currentUser.workspace.id,
      },
    });

    revalidatePath('/clients');
    return {};
  } catch (err) {
    console.error('Error deleting client:', err);
    return { error: 'Failed to delete client.' };
  }
}
