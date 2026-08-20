// BillCraft AI integration service
// Uses a mock implementation when api_key starts with "mock_" or is empty.
// Uses node:http/https (not fetch/undici) for all real HTTP calls — avoids premature-close issues.
// Set BILLCRAFT_INTERNAL_URL=http://billcraft:3000/api in Docker so server-side calls use
// the internal Docker service name rather than going out through nginx.

import http  from 'node:http'
import https from 'node:https'

// Supports both http:// and https:// — picks the right module based on the URL scheme.
function nodeRequest(
  method: 'GET' | 'POST',
  url: string,
  headers: Record<string, string>,
  body?: string,
  timeoutMs = 10_000,
): Promise<{ status: number; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const isHttps = u.protocol === 'https:'
    const defaultPort = isHttps ? 443 : 80
    const options = {
      hostname: u.hostname,
      port:     u.port || defaultPort,
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
        resolve({
          status: res.statusCode ?? 0,
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
  // effectiveUrl: uses BILLCRAFT_INTERNAL_URL env var when set (Docker service-to-service),
  // falling back to the user-configured baseUrl. This avoids hairpin NAT issues in Docker
  // where containers can't reliably reach each other via the public hostname → nginx path.
  private readonly effectiveUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = 'https://billcraft.aakasa.dev/api',
  ) {
    this.isMock = !apiKey || apiKey.startsWith('mock_') || apiKey === 'demo';
    this.effectiveUrl = process.env.BILLCRAFT_INTERNAL_URL || this.baseUrl;
  }

  async testConnection(): Promise<{ ok: boolean; workspace?: BillCraftWorkspace; error?: string }> {
    if (this.isMock) {
      await delay(400);
      return { ok: true, workspace: { id: 'mock-ws-1', name: 'Demo Workspace (Mock)', currency: 'USD' } };
    }
    try {
      const res = await nodeRequest('GET', `${this.effectiveUrl}/v1/workspace`, this.headers())
      if (res.status !== 200) return { ok: false, error: `HTTP ${res.status}` }
      const data = await res.json() as { workspace?: BillCraftWorkspace }
      return { ok: true, workspace: data.workspace ?? (data as unknown as BillCraftWorkspace) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
    }
  }

  async getClients(): Promise<BillCraftClient[]> {
    if (this.isMock) {
      await delay(300);
      return MOCK_CLIENTS;
    }
    const res = await nodeRequest('GET', `${this.effectiveUrl}/v1/clients`, this.headers())
    if (res.status !== 200) throw new Error(`BillCraft API error: ${res.status}`)
    const data = await res.json() as { data?: BillCraftClient[] }
    return (data.data ?? data) as BillCraftClient[]
  }

  async getProjects(): Promise<BillCraftProject[]> {
    if (this.isMock) {
      await delay(300);
      return MOCK_PROJECTS;
    }
    const res = await nodeRequest('GET', `${this.effectiveUrl}/v1/projects`, this.headers())
    if (res.status !== 200) throw new Error(`BillCraft API error: ${res.status}`)
    const data = await res.json() as { data?: BillCraftProject[] }
    return (data.data ?? data) as BillCraftProject[]
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
        url:        `https://billcraft.aakasa.dev/invoices/${num}`,
      };
    }
    const body = JSON.stringify(payload)
    const res = await nodeRequest(
      'POST', `${this.effectiveUrl}/v1/invoices`,
      { ...this.headers(), 'Content-Type': 'application/json' },
      body, 15_000,
    )
    if (res.status !== 201 && res.status !== 200) throw new Error(`BillCraft API error: ${res.status}`)
    const data = await res.json() as { data?: BillCraftInvoice }
    return (data.data ?? data) as BillCraftInvoice
  }

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' };
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export async function getBillCraftService(workspaceId: string): Promise<BillCraftService | null> {
  const { prisma } = await import('@/lib/prisma');

  const setting = await prisma.integrationSetting.findUnique({
    where: { workspaceId_integrationType: { workspaceId, integrationType: 'billcraft' } },
    select: { config: true },
  });

  if (!setting) return null;
  const cfg = setting.config as { api_key?: string; api_url?: string; enabled?: boolean } | null;
  const apiKey = cfg?.api_key ?? '';
  const apiUrl = cfg?.api_url;

  return new BillCraftService(apiKey, apiUrl);
}

// ─────────────────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
