// SupportCraft AI integration service.
// Mock mode activates when api_key is empty, "demo", or starts with "mock_".
// Uses node:http/https for all real HTTP calls — avoids undici/fetch issues.
// Set SUPPORTCRAFT_INTERNAL_URL=http://supportcraft:3002/api/v1 in Docker.

import http  from 'node:http'
import https from 'node:https'
import type { TaskStatus } from '@/lib/types';

function nodeRequest(
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  headers: Record<string, string>,
  body?: string,
  timeoutMs = 10_000,
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const isHttps = u.protocol === 'https:'
    const options = {
      hostname: u.hostname,
      port:     u.port || (isHttps ? 443 : 80),
      path:     u.pathname + u.search,
      method,
      headers:  body
        ? { ...headers, 'Content-Length': String(Buffer.byteLength(body)) }
        : headers,
      agent: isHttps
        ? new https.Agent({ keepAlive: false })
        : new http.Agent({ keepAlive: false }),
    }
    const transport = isHttps ? https : http
    const req = transport.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString()
        const status = res.statusCode ?? 0
        resolve({
          ok:   status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(JSON.parse(text)),
        })
      })
    })
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

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
  private readonly effectiveUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://supportcraft.aakasa.dev/api/v1',
  ) {
    this.isMock = !apiKey || apiKey.startsWith('mock_') || apiKey === 'demo';
    this.effectiveUrl = process.env.SUPPORTCRAFT_INTERNAL_URL || this.baseUrl;
  }

  async testConnection(): Promise<{ ok: boolean; workspace?: SupportCraftWorkspace; error?: string }> {
    if (this.isMock) {
      await delay(350);
      return { ok: true, workspace: { id: 'mock-ws-sc', name: 'Demo Support Workspace (Mock)' } };
    }
    try {
      const res = await nodeRequest('GET', `${this.effectiveUrl}/workspace`, this.headers())
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json() as { workspace?: SupportCraftWorkspace };
      return { ok: true, workspace: data.workspace ?? (data as unknown as SupportCraftWorkspace) };
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
    const u = new URL(`${this.effectiveUrl}/tickets`);
    if (params?.status) u.searchParams.set('status', params.status);
    if (params?.limit)  u.searchParams.set('per_page', String(params.limit));
    const res = await nodeRequest('GET', u.toString(), this.headers())
    if (!res.ok) throw new Error(`SupportCraft API error: ${res.status}`);
    const data = await res.json() as { data?: SupportCraftTicket[] };
    return (data.data ?? data) as SupportCraftTicket[];
  }

  async getTicket(id: string): Promise<SupportCraftTicket> {
    if (this.isMock) {
      await delay(200);
      const ticket = MOCK_TICKETS.find((t) => t.id === id || t.number === id);
      if (!ticket) throw new Error(`Ticket ${id} not found`);
      return ticket;
    }
    const res = await nodeRequest('GET', `${this.effectiveUrl}/tickets/${id}`, this.headers())
    if (!res.ok) throw new Error(`SupportCraft API error: ${res.status}`);
    const data = await res.json() as { data?: SupportCraftTicket };
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
    const res = await nodeRequest(
      'POST', `${this.effectiveUrl}/tickets/${ticketId}/notes`,
      { ...this.headers(), 'Content-Type': 'application/json' },
      JSON.stringify({ content, is_internal: isInternal }),
      10_000,
    )
    if (!res.ok) throw new Error(`SupportCraft API error: ${res.status}`);
    const data = await res.json() as { data?: SupportCraftNote };
    return (data.data ?? data) as SupportCraftNote;
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
    if (this.isMock) {
      await delay(300);
      return;
    }
    const res = await nodeRequest(
      'PATCH', `${this.effectiveUrl}/tickets/${ticketId}`,
      { ...this.headers(), 'Content-Type': 'application/json' },
      JSON.stringify({ status }),
      10_000,
    )
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
