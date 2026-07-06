import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('support_ticket_links')
    .select('*')
    .eq('task_id', id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data: data ?? [] });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: taskId } = await params;
  const { searchParams } = new URL(req.url);
  const linkId = searchParams.get('link_id');
  if (!linkId) return Response.json({ error: 'Missing link_id' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('support_ticket_links')
    .delete()
    .eq('id', linkId)
    .eq('task_id', taskId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
