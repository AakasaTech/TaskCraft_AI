import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/prisma';
import { ClientDetailClient } from './_components/ClientDetailClient';

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: client?.name ?? 'Client' };
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const wid = currentUser.workspace.id;

  const client = await prisma.client.findFirst({
    where: { id, workspaceId: wid },
  });

  if (!client) notFound();

  const [projectsRes, invoicesRes, supportRes] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId: wid, clientId: id },
      select: {
        id: true,
        name: true,
        color: true,
        status: true,
        billable: true,
        dueDate: true,
        hourlyRate: true,
      },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.invoicesSync.findMany({
      where: { workspaceId: wid, clientId: id },
      orderBy: { createdAt: 'desc' },
    }),

    prisma.supportTicketLink.findMany({
      where: { workspaceId: wid },
      include: {
        task: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const projectIds = projectsRes.map((p) => p.id);

  const [tasksRes, timeRes] = await Promise.all([
    projectIds.length > 0
      ? prisma.task.findMany({
          where: {
            workspaceId: wid,
            projectId: { in: projectIds },
            status: { not: 'done' },
          },
          include: {
            project: { select: { name: true, color: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : Promise.resolve([]),

    projectIds.length > 0
      ? prisma.timeEntry.findMany({
          where: {
            workspaceId: wid,
            projectId: { in: projectIds },
          },
          include: {
            project: { select: { name: true, color: true } },
          },
          orderBy: { startTime: 'desc' },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  // Shape projects
  const shapedProjects = projectsRes.map((p) => ({
    id:          p.id,
    name:        p.name,
    color:       p.color,
    status:      p.status,
    billable:    p.billable,
    due_date:    p.dueDate ? p.dueDate.toISOString().split('T')[0] : null,
    hourly_rate: p.hourlyRate ? Number(p.hourlyRate) : null,
  }));

  // Shape tasks
  const shapedTasks = tasksRes.map((t) => ({
    id:            t.id,
    title:         t.title,
    status:        t.status,
    priority:      t.priority,
    due_date:      t.dueDate ? t.dueDate.toISOString().split('T')[0] : null,
    project_id:    t.projectId,
    project_name:  t.project?.name ?? null,
    project_color: t.project?.color ?? null,
  }));

  // Shape time entries
  const shapedTimeEntries = timeRes.map((e) => ({
    id:               e.id,
    description:      e.description,
    start_time:       e.startTime.toISOString(),
    end_time:         e.endTime?.toISOString() ?? null,
    duration_minutes: e.durationMinutes ?? 0,
    billable:         e.billable,
    hourly_rate:      e.hourlyRate ? Number(e.hourlyRate) : null,
    project_id:       e.projectId,
    project_name:     e.project?.name ?? null,
    project_color:    e.project?.color ?? null,
  }));

  // Shape client
  const shapedClient = {
    id:                  client.id,
    workspace_id:        client.workspaceId,
    name:                client.name,
    email:               client.email,
    billing_email:       null,
    phone:               client.phone,
    company:             client.company,
    website:             client.website,
    address:             (client.address as any) ?? {},
    notes:               client.notes,
    default_hourly_rate: null,
    currency:            'USD',
    billcraft_client_id: client.billcraftClientId,
    created_at:          client.createdAt.toISOString(),
    updated_at:          client.updatedAt.toISOString(),
  };

  const shapedInvoices = invoicesRes.map((i) => ({
    id:                   i.id,
    workspace_id:         i.workspaceId,
    project_id:           i.projectId,
    client_id:            i.clientId,
    user_id:              i.userId,
    billcraft_invoice_id: i.billcraftInvoiceId,
    total_hours:          i.totalHours ? Number(i.totalHours) : null,
    total_amount:         i.totalAmount ? Number(i.totalAmount) : null,
    currency:             i.currency,
    status:               i.status,
    synced_at:            i.syncedAt?.toISOString() ?? null,
    created_at:           i.createdAt.toISOString(),
  }));

  const shapedSupportLinks = supportRes.map((s) => ({
    id:                     s.id,
    workspace_id:           s.workspaceId,
    task_id:                s.taskId,
    supportcraft_ticket_id: s.supportcraftTicketId,
    ticket_title:           s.ticketTitle,
    ticket_url:             s.ticketUrl,
    sync_status:            s.syncStatus,
    created_at:             s.createdAt.toISOString(),
    updated_at:             s.updatedAt.toISOString(),
    task_title:             s.task?.title ?? null,
    task_status:            s.task?.status ?? null,
  }));

  return (
    <ClientDetailClient
      client={shapedClient as any}
      projects={shapedProjects as any}
      tasks={shapedTasks as any}
      timeEntries={shapedTimeEntries as any}
      invoices={shapedInvoices as any}
      supportLinks={shapedSupportLinks as any}
    />
  );
}
