import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/helpers';

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
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const type        = new URL(req.url).searchParams.get('type') ?? '';
  const workspaceId = currentUser.workspace.id;
  const uid         = currentUser.profile.id;

  let csv  = '';
  let name = 'export.csv';

  switch (type) {
    case 'time-entries': {
      const entries = await prisma.timeEntry.findMany({
        where: { userId: uid },
        orderBy: { startTime: 'desc' },
        select: {
          id: true, description: true, durationMinutes: true, startTime: true, endTime: true,
          billable: true, hourlyRate: true, invoiceStatus: true, createdAt: true,
        },
      });
      csv = toCsv(entries.map((e) => ({
        id:               e.id,
        description:      e.description,
        duration_minutes: e.durationMinutes,
        started_at:       e.startTime.toISOString(),
        ended_at:         e.endTime ? e.endTime.toISOString() : null,
        billable:         e.billable,
        hourly_rate:      e.hourlyRate,
        invoice_status:   e.invoiceStatus,
        created_at:       e.createdAt.toISOString(),
      })));
      name = 'time-entries.csv';
      break;
    }

    case 'projects': {
      const projects = await prisma.project.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, description: true, status: true, startDate: true, dueDate: true, budget: true, createdAt: true },
      });
      csv = toCsv(projects.map((p) => ({
        id:          p.id,
        name:        p.name,
        description: p.description,
        status:      p.status,
        start_date:  p.startDate ? p.startDate.toISOString() : null,
        due_date:    p.dueDate ? p.dueDate.toISOString() : null,
        budget:      p.budget,
        created_at:  p.createdAt.toISOString(),
      })));
      name = 'projects.csv';
      break;
    }

    case 'tasks': {
      const tasks = await prisma.task.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, description: true, status: true, priority: true, dueDate: true, estimatedHours: true, createdAt: true },
      });
      csv = toCsv(tasks.map((t) => ({
        id:              t.id,
        title:           t.title,
        description:     t.description,
        status:          t.status,
        priority:        t.priority,
        due_date:        t.dueDate ? t.dueDate.toISOString() : null,
        estimated_hours: t.estimatedHours,
        created_at:      t.createdAt.toISOString(),
      })));
      name = 'tasks.csv';
      break;
    }

    case 'clients': {
      if (!['solo', 'team'].includes(currentUser.profile.plan)) {
        return Response.json({ error: 'Clients export requires Solo or Team plan.' }, { status: 403 });
      }
      const clients = await prisma.client.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, company: true, phone: true, website: true, createdAt: true },
      });
      csv = toCsv(clients.map((c) => ({
        id:         c.id,
        name:       c.name,
        email:      c.email,
        company:    c.company,
        phone:      c.phone,
        website:    c.website,
        created_at: c.createdAt.toISOString(),
      })));
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
