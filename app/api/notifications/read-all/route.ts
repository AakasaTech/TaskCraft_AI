import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: now })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
