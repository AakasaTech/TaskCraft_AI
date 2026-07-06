// SupportCraft AI integration service.
// Mock mode activates when api_key is empty, "demo", or starts with "mock_".

import type { TaskStatus } from '@/lib/types';

export interface SupportCraftWorkspace {
  id:   string;
  name: string;
}

export interface SupportCraftTicket {
  id:          string;
  number:      string;   // e.g. "TICKET-1042"
  title:       string;
  description: string;
  status:      'open' | 'pending' | 'resolved' | 'closed';
  priority:    'low' | 'normal' | 'high' | 'urgent';
  client_id:   string;
  client_name: string;
  url:         string;
  created_at:  string;
  updated_at:  string;
}

export interface SupportCraftNote {
  id:          string;
  ticket_id:   string;
  content:     string;
  author:      string;
  is_internal: boolean;
  created_at:  string;
}

export type TicketStatus = SupportCraftTicket['status'];

// ── Status mappings ───────────────────────────────────────────────────────────

export const TICKET_TO_TASK: Record<TicketStatus, TaskStatus> = {
  open:     'todo',
  pending:  'in_progress',
  resolved: 'in_review',
  closed:   'done',
};

export const TASK_TO_TICKET: Partial<Record<TaskStatus, TicketStatus>> = {
  todo:        'open',
  in_progress: 'pending',
  in_review:   'resolved',
  done:        'closed',
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_TICKETS: SupportCraftTicket[] = [
  {
    id: 'mock-t1', number: 'TICKET-1042',
    title: 'Login page throws 500 on staging',
    description: 'Users are unable to log in on the staging environment. The server returns a 500 error immediately after clicking sign in.',
    status: 'open', priority: 'urgent', client_id: 'mock-c1', client_name: 'Acme Corp',
    url: 'https://app.supportcraft.ai/tickets/TICKET-1042',
    created_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 3600_000).toISOString(),
  },
  {
    id: 'mock-t2', number: 'TICKET-1041',
    title: 'CSV export missing billing column',
    description: 'When exporting time entries as CSV, the billing rate column is empty for all rows.',
    status: 'open', priority: 'high', client_id: 'mock-c2', client_name: 'Globex Inc',
    url: 'https://app.supportcraft.ai/tickets/TICKET-1041',
    created_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 3600_000).toISOString(),
  },
  {
    id: 'mock-t3', number: 'TICKET-1039',
    title: 'Dark mode toggle not persisting',
    description: 'After refreshing the page, the dark mode setting resets to light mode despite being saved.',
    status: 'pending', priority: 'normal', client_id: 'mock-c1', client_name: 'Acme Corp',
    url: 'https://app.supportcraft.ai/tickets/TICKET-1039',
    created_at: new Date(Date.now() - 48 * 3600_000).toISOString(),
    updated_at: new Date(Date.now() - 36 * 3600_000).toISOString(),
  },
  {
    id: 'mock-t4', number: 'TICKET-1037',
    title: 'Notification emails going to spam',
    description: 'Task assignment emails are being flagged as spam by Google Workspace.',
    status: 'pending', priority: 'high', client_id: 'mock-c3', client_name: 'Initech',
    url: 'https://app.supportcraft.ai/tickets/TICKET-1037',
    created_at: new Date(Date.now() - 72 * 3600_000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 3600_000).toISOString(),
  },
  {
    id: 'mock-t5', number: 'TICKET-1033',
    title: 'Request: bulk task import from CSV',
    description: 'Can we have the ability to import multiple tasks at once from a CSV file?',
    status: 'open', priority: 'low', client_id: 'mock-c2', client_name: 'Globex Inc',
    url: 'https://app.supportcraft.ai/tickets/TICKET-1033',
    created_at: new Date(Date.now() - 96 * 3600_000).toISOString(),
    updated_at: new Date(Date.now() - 90 * 3600_000).toISOString(),
  },
];

// ── Service class ─────────────────────────────────────────────────────────────

export class SupportCraftService {
  private readonly isMock: boolean;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://app.supportcraft.ai/api',
  ) {
    this.isMock = !apiKey || apiKey.startsWith('mock_') || apiKey === 'demo';
  }

  async testConnection(): Promise<{ ok: boolean; workspace?: SupportCraftWorkspace; error?: string }> {
    if (this.isMock) {
      await delay(350);
      return { ok: true, workspace: { id: 'mock-ws-sc', name: 'Demo Support Workspace (Mock)' } };
    }
    try {
      const res = await fetch(`${this.baseUrl}/v1/workspace`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      return { ok: true, workspace: data.workspace ?? data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
  }

  async getTickets(params?: {
    status?:   TicketStatus;
    limit?:    number;
  }): Promise<SupportCraftTicket[]> {
    if (this.isMock) {
      await delay(300);
      let tickets = [...MOCK_TICKETS];
      if (params?.status) tickets = tickets.filter((t) => t.status === params.status);
      return tickets.slice(0, params?.limit ?? 20);
    }
    const url = new URL(`${this.baseUrl}/v1/tickets`);
    if (params?.status) url.searchParams.set('status', params.status);
    if (params?.limit)  url.searchParams.set('per_page', String(params.limit));
    const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`SupportCraft API error: ${res.status}`);
    const data = await res.json();
    return (data.data ?? data) as SupportCraftTicket[];
  }

  async getTicket(id: string): Promise<SupportCraftTicket> {
    if (this.isMock) {
      await delay(200);
      const ticket = MOCK_TICKETS.find((t) => t.id === id || t.number === id);
      if (!ticket) throw new Error(`Ticket ${id} not found`);
      return ticket;
    }
    const res = await fetch(`${this.baseUrl}/v1/tickets/${id}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`SupportCraft API error: ${res.status}`);
    const data = await res.json();
    return (data.data ?? data) as SupportCraftTicket;
  }

  async addNote(ticketId: string, content: string, isInternal = true): Promise<SupportCraftNote> {
    if (this.isMock) {
      await delay(400);
      return {
        id:          `mock-note-${Date.now()}`,
        ticket_id:   ticketId,
        content,
        author:      'TaskCraft AI',
        is_internal: isInternal,
        created_at:  new Date().toISOString(),
      };
    }
    const res = await fetch(`${this.baseUrl}/v1/tickets/${ticketId}/notes`, {
      method:  'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content, is_internal: isInternal }),
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`SupportCraft API error: ${res.status}`);
    const data = await res.json();
    return (data.data ?? data) as SupportCraftNote;
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
    if (this.isMock) {
      await delay(300);
      return;
    }
    const res = await fetch(`${this.baseUrl}/v1/tickets/${ticketId}`, {
      method:  'PATCH',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`SupportCraft API error: ${res.status}`);
  }

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export async function getSupportCraftService(workspaceId: string): Promise<SupportCraftService | null> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data } = await supabase
    .from('integration_settings')
    .select('config, enabled')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'supportcraft')
    .single();

  if (!data) return null;
  const cfg = data.config as { api_key?: string; api_url?: string } | null;
  return new SupportCraftService(cfg?.api_key ?? '', cfg?.api_url);
}

// ─────────────────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
