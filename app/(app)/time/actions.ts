'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function getContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single();
  if (!member) throw new Error('No workspace');
  return { supabase, uid: user.id, wid: member.workspace_id };
}

export async function startTimer(input: {
  description?: string;
  task_id?: string;
  project_id?: string;
  billable?: boolean;
  hourly_rate?: number;
}) {
  const { supabase, uid, wid } = await getContext();

  // Enforce single active timer per user
  await supabase
    .from('time_entries')
    .update({ end_time: new Date().toISOString() })
    .eq('user_id', uid)
    .eq('workspace_id', wid)
    .is('end_time', null);

  const { data, error } = await supabase
    .from('time_entries')
    .insert({
      workspace_id: wid,
      user_id: uid,
      description: input.description || null,
      task_id: input.task_id || null,
      project_id: input.project_id || null,
      billable: input.billable ?? false,
      hourly_rate: input.hourly_rate ?? null,
      start_time: new Date().toISOString(),
      source: 'timer',
    })
    .select('id, start_time')
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/time');
  revalidatePath('/dashboard');
  return data;
}

export async function stopTimer(entryId: string) {
  const { supabase, uid } = await getContext();
  const { error } = await supabase
    .from('time_entries')
    .update({ end_time: new Date().toISOString() })
    .eq('id', entryId)
    .eq('user_id', uid);
  if (error) throw new Error(error.message);
  revalidatePath('/time');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

export async function createManualEntry(input: {
  description?: string;
  task_id?: string;
  project_id?: string;
  start_time: string;
  end_time: string;
  billable?: boolean;
  hourly_rate?: number;
}) {
  const { supabase, uid, wid } = await getContext();
  const { error } = await supabase
    .from('time_entries')
    .insert({
      workspace_id: wid,
      user_id: uid,
      description: input.description || null,
      task_id: input.task_id || null,
      project_id: input.project_id || null,
      start_time: input.start_time,
      end_time: input.end_time,
      billable: input.billable ?? false,
      hourly_rate: input.hourly_rate ?? null,
      source: 'manual',
    });
  if (error) throw new Error(error.message);
  revalidatePath('/time');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

export async function updateTimeEntry(
  id: string,
  input: {
    description?: string;
    task_id?: string | null;
    project_id?: string | null;
    start_time?: string;
    end_time?: string;
    billable?: boolean;
    hourly_rate?: number | null;
  },
) {
  const { supabase, uid } = await getContext();
  // Strip undefined so we don't overwrite unintended columns
  const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const { error } = await supabase
    .from('time_entries')
    .update(patch)
    .eq('id', id)
    .eq('user_id', uid);
  if (error) throw new Error(error.message);
  revalidatePath('/time');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

export async function deleteTimeEntry(id: string) {
  const { supabase, uid } = await getContext();
  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', uid);
  if (error) throw new Error(error.message);
  revalidatePath('/time');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}
