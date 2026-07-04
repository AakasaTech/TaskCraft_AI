import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape  = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const type = new URL(req.url).searchParams.get('type') ?? '';

  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const workspaceId = member?.workspace_id;

  let csv    = '';
  let name   = 'export.csv';

  switch (type) {
    case 'time-entries': {
      const { data } = await supabase
        .from('time_entries')
        .select('id, description, duration_minutes, started_at, ended_at, billable, hourly_rate, invoice_status, created_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });
      csv  = toCsv((data ?? []) as Record<string, unknown>[]);
      name = 'time-entries.csv';
      break;
    }

    case 'projects': {
      if (!workspaceId) { csv = ''; break; }
      const { data } = await supabase
        .from('projects')
        .select('id, name, description, status, start_date, due_date, budget_hours, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      csv  = toCsv((data ?? []) as Record<string, unknown>[]);
      name = 'projects.csv';
      break;
    }

    case 'tasks': {
      if (!workspaceId) { csv = ''; break; }
      const { data } = await supabase
        .from('tasks')
        .select('id, title, description, status, priority, due_date, estimated_minutes, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      csv  = toCsv((data ?? []) as Record<string, unknown>[]);
      name = 'tasks.csv';
      break;
    }

    case 'clients': {
      if (!workspaceId) { csv = ''; break; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single();
      if (!['solo', 'team'].includes(profile?.plan ?? '')) {
        return Response.json({ error: 'Clients export requires Solo or Team plan.' }, { status: 403 });
      }
      const { data } = await supabase
        .from('clients')
        .select('id, name, email, company, phone, website, currency, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      csv  = toCsv((data ?? []) as Record<string, unknown>[]);
      name = 'clients.csv';
      break;
    }

    default:
      return Response.json({ error: 'Unknown export type.' }, { status: 400 });
  }

  return new Response(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
    },
  });
}
