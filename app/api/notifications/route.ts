import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '30'), 100);
  const before = searchParams.get('before'); // cursor: created_at of last item

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('created_at', before);

  const [listRes, countRes] = await Promise.all([
    query,
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false),
  ]);

  if (listRes.error) return Response.json({ error: listRes.error.message }, { status: 500 });

  return Response.json({
    notifications: listRes.data,
    unread_count:  countRes.count ?? 0,
    has_more:      listRes.data.length === limit,
  });
}
