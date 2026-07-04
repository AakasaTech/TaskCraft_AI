'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { CreateClientInput, UpdateClientInput } from '@/lib/types';

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single();
  if (!member) return null;
  return { supabase, userId: user.id, wid: member.workspace_id };
}

export async function createClientRecord(input: CreateClientInput) {
  const ctx = await getContext();
  if (!ctx) return { error: 'Unauthorized' };

  const { data, error } = await ctx.supabase
    .from('clients')
    .insert({
      workspace_id:        ctx.wid,
      created_by:          ctx.userId,
      name:                input.name,
      email:               input.email     || null,
      billing_email:       input.billing_email || null,
      phone:               input.phone     || null,
      company:             input.company   || null,
      website:             input.website   || null,
      address:             input.address   ?? {},
      notes:               input.notes     || null,
      default_hourly_rate: input.default_hourly_rate ?? null,
      currency:            input.currency  ?? 'USD',
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/clients');
  return { id: data.id };
}

export async function updateClientRecord(id: string, input: UpdateClientInput) {
  const ctx = await getContext();
  if (!ctx) return { error: 'Unauthorized' };

  const patch: Record<string, unknown> = {};
  if (input.name               !== undefined) patch.name                = input.name;
  if (input.email              !== undefined) patch.email               = input.email || null;
  if (input.billing_email      !== undefined) patch.billing_email       = input.billing_email || null;
  if (input.phone              !== undefined) patch.phone               = input.phone || null;
  if (input.company            !== undefined) patch.company             = input.company || null;
  if (input.website            !== undefined) patch.website             = input.website || null;
  if (input.address            !== undefined) patch.address             = input.address;
  if (input.notes              !== undefined) patch.notes               = input.notes || null;
  if (input.default_hourly_rate !== undefined) patch.default_hourly_rate = input.default_hourly_rate ?? null;
  if (input.currency           !== undefined) patch.currency            = input.currency;

  const { error } = await ctx.supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .eq('workspace_id', ctx.wid);

  if (error) return { error: error.message };
  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  return {};
}

export async function deleteClientRecord(id: string) {
  const ctx = await getContext();
  if (!ctx) return { error: 'Unauthorized' };

  const { error } = await ctx.supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('workspace_id', ctx.wid);

  if (error) return { error: error.message };
  revalidatePath('/clients');
  return {};
}
