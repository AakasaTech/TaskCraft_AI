// BillCraft AI integration service
// Uses a mock implementation when api_key starts with "mock_" or is empty.
// Replace mock branches with real fetch calls once BillCraft publishes its API.

export interface BillCraftWorkspace {
  id:       string;
  name:     string;
  currency: string;
}

export interface BillCraftClient {
  id:      string;
  name:    string;
  email:   string | null;
  company: string | null;
}

export interface BillCraftProject {
  id:        string;
  name:      string;
  client_id: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity:    number;    // hours
  rate:        number;    // hourly rate
  amount:      number;    // quantity * rate
}

export interface CreateInvoicePayload {
  billcraft_client_id: string;
  title:               string;
  due_date?:           string | null;
  currency:            string;
  notes?:              string | null;
  line_items:          InvoiceLineItem[];
  metadata?: {
    source:       'taskcraft';
    workspace_id: string;
    project_id?:  string | null;
    date_from:    string;
    date_to:      string;
    entry_ids:    string[];
  };
}

export interface BillCraftInvoice {
  id:         string;
  number:     string;
  client_id:  string;
  title:      string;
  status:     'draft' | 'sent' | 'paid';
  total:      number;
  currency:   string;
  created_at: string;
  url?:       string;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_CLIENTS: BillCraftClient[] = [
  { id: 'mock-c1', name: 'Acme Corp',    email: 'billing@acme.com',    company: 'Acme Corporation' },
  { id: 'mock-c2', name: 'Globex Inc',   email: 'accounts@globex.com', company: 'Globex Inc.' },
  { id: 'mock-c3', name: 'Initech',      email: null,                  company: 'Initech' },
  { id: 'mock-c4', name: 'Umbrella Ltd', email: 'billing@umbrella.com',company: 'Umbrella Ltd' },
];

const MOCK_PROJECTS: BillCraftProject[] = [
  { id: 'mock-p1', name: 'Website Redesign', client_id: 'mock-c1' },
  { id: 'mock-p2', name: 'Mobile App',       client_id: 'mock-c1' },
  { id: 'mock-p3', name: 'API Integration',  client_id: 'mock-c2' },
  { id: 'mock-p4', name: 'Data Migration',   client_id: 'mock-c3' },
];

// ── Service class ─────────────────────────────────────────────────────────────

export class BillCraftService {
  private readonly isMock: boolean;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://billcraft.aakasa.dev/api',
  ) {
    this.isMock = !apiKey || apiKey.startsWith('mock_') || apiKey === 'demo';
  }

  async testConnection(): Promise<{ ok: boolean; workspace?: BillCraftWorkspace; error?: string }> {
    if (this.isMock) {
      await delay(400);
      return { ok: true, workspace: { id: 'mock-ws-1', name: 'Demo Workspace (Mock)', currency: 'USD' } };
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

  async getClients(): Promise<BillCraftClient[]> {
    if (this.isMock) {
      await delay(300);
      return MOCK_CLIENTS;
    }
    const res = await fetch(`${this.baseUrl}/v1/clients`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`BillCraft API error: ${res.status}`);
    const data = await res.json();
    return (data.data ?? data) as BillCraftClient[];
  }

  async getProjects(): Promise<BillCraftProject[]> {
    if (this.isMock) {
      await delay(300);
      return MOCK_PROJECTS;
    }
    const res = await fetch(`${this.baseUrl}/v1/projects`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`BillCraft API error: ${res.status}`);
    const data = await res.json();
    return (data.data ?? data) as BillCraftProject[];
  }

  async createInvoice(payload: CreateInvoicePayload): Promise<BillCraftInvoice> {
    if (this.isMock) {
      await delay(700);
      const num = `INV-${Date.now().toString().slice(-5)}`;
      const total = payload.line_items.reduce((s, li) => s + li.amount, 0);
      return {
        id:         `mock-inv-${Math.random().toString(36).slice(2, 8)}`,
        number:     num,
        client_id:  payload.billcraft_client_id,
        title:      payload.title,
        status:     'draft',
        total,
        currency:   payload.currency,
        created_at: new Date().toISOString(),
        url:        `https://app.billcraft.ai/invoices/${num}`,
      };
    }
    const res = await fetch(`${this.baseUrl}/v1/invoices`, {
      method:  'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`BillCraft API error: ${res.status}`);
    const data = await res.json();
    return (data.data ?? data) as BillCraftInvoice;
  }

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export async function getBillCraftService(workspaceId: string): Promise<BillCraftService | null> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();

  const { data } = await supabase
    .from('integration_settings')
    .select('config, enabled')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'billcraft')
    .single();

  if (!data) return null;
  const cfg = data.config as { api_key?: string; api_url?: string; enabled?: boolean } | null;
  const apiKey = cfg?.api_key ?? '';
  const apiUrl = cfg?.api_url;

  return new BillCraftService(apiKey, apiUrl);
}

// ─────────────────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
