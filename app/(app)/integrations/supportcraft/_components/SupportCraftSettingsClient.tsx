'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, XCircle, Loader2, Unplug, ExternalLink,
  Zap, Copy, RefreshCw, Check, Plus, FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection } from '@/components/shared/SettingsSection';
import {
  saveSupportCraftSettings,
  testSupportCraftConnection,
  regenerateWebhookSecret,
  disconnectSupportCraft,
  loadRecentTickets,
  createTaskFromTicket,
} from '../actions';
import type { SupportCraftTicket } from '@/lib/supportcraft';

const STATUS_STYLES: Record<string, string> = {
  open:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pending:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed:   'bg-muted text-muted-foreground',
};

const PRIORITY_STYLES: Record<string, string> = {
  low:    'text-green-500',
  normal: 'text-muted-foreground',
  high:   'text-orange-500',
  urgent: 'text-red-500',
};

interface Props {
  connected:          boolean;
  apiKey:             string;
  apiUrl:             string;
  webhookSecret:      string;
  autoCreateTasks:    boolean;
  defaultProjectId:   string;
  syncStatusBack:     boolean;
  appUrl:             string;
  workspaceId:        string;
  projects:           { id: string; name: string }[];
}

export function SupportCraftSettingsClient({
  connected,
  apiKey:             initialKey,
  apiUrl:             initialUrl,
  webhookSecret:      initialSecret,
  autoCreateTasks:    initialAutoCreate,
  defaultProjectId:   initialDefaultProject,
  syncStatusBack:     initialSyncBack,
  appUrl,
  workspaceId,
  projects,
}: Props) {
  const router = useRouter();

  const [apiKey,             setApiKey]             = useState(initialKey);
  const [apiUrl,             setApiUrl]             = useState(initialUrl || 'https://supportcraft.aakasa.dev/api/v1');
  const [webhookSecret,      setWebhookSecret]      = useState(initialSecret);
  const [autoCreateTasks,    setAutoCreateTasks]    = useState(initialAutoCreate);
  const [defaultProjectId,   setDefaultProjectId]   = useState(initialDefaultProject);
  const [syncStatusBack,     setSyncStatusBack]     = useState(initialSyncBack);
  const [secretVisible,      setSecretVisible]      = useState(false);
  const [copied,             setCopied]             = useState(false);
  const [testResult,         setTestResult]         = useState<{ ok: boolean; name?: string } | null>(null);

  const [tickets,            setTickets]            = useState<SupportCraftTicket[] | null>(null);
  const [linkedSet,          setLinkedSet]          = useState<Set<string>>(new Set());
  const [creatingFor,        setCreatingFor]        = useState<string | null>(null);
  const [projectFor,         setProjectFor]         = useState<Record<string, string>>({});

  const [isSaving,      startSave]      = useTransition();
  const [isTesting,     startTest]      = useTransition();
  const [isRegen,       startRegen]     = useTransition();
  const [isDisconn,     startDisconn]   = useTransition();
  const [isLoadTix,     startLoadTix]   = useTransition();

  const webhookUrl = `${appUrl}/api/supportcraft/webhook?workspace_id=${workspaceId}`;
  const inputCls   = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30';

  function handleCopyWebhook() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSave() {
    startSave(async () => {
      const res = await saveSupportCraftSettings({
        api_key:            apiKey,
        api_url:            apiUrl,
        auto_create_tasks:  autoCreateTasks,
        default_project_id: defaultProjectId,
        sync_status_back:   syncStatusBack,
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        if (res?.data?.webhook_secret) setWebhookSecret(res.data.webhook_secret);
        toast.success('Settings saved');
        router.refresh();
      }
    });
  }

  function handleTest() {
    setTestResult(null);
    startTest(async () => {
      const res = await testSupportCraftConnection();
      if ('ok' in res && res.ok) {
        setTestResult({ ok: true, name: res.workspace?.name });
        toast.success('Connection successful!');
      } else {
        setTestResult({ ok: false });
        toast.error('error' in res ? res.error : 'Connection failed');
      }
    });
  }

  function handleRegen() {
    startRegen(async () => {
      const res = await regenerateWebhookSecret();
      if (res?.error) {
        toast.error(res.error);
      } else {
        setWebhookSecret(res.data!.webhook_secret);
        toast.success('Webhook secret regenerated');
      }
    });
  }

  function handleDisconnect() {
    startDisconn(async () => {
      const res = await disconnectSupportCraft();
      if (res?.error) { toast.error(res.error); }
      else { toast.success('SupportCraft disconnected'); router.refresh(); }
    });
  }

  function handleLoadTickets() {
    startLoadTix(async () => {
      const res = await loadRecentTickets();
      if (res?.error) { toast.error(res.error); }
      else {
        setTickets(res.data!.tickets);
        setLinkedSet(new Set(res.data!.linkedSet));
      }
    });
  }

  async function handleCreateTask(ticket: SupportCraftTicket) {
    setCreatingFor(ticket.id);
    try {
      const res = await createTaskFromTicket({
        ticketId:       ticket.id,
        ticketNumber:   ticket.number,
        ticketTitle:    ticket.title,
        ticketUrl:      ticket.url,
        ticketStatus:   ticket.status,
        ticketPriority: ticket.priority,
        clientName:     ticket.client_name,
        projectId:      projectFor[ticket.id] ?? null,
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Task created from ${ticket.number}`);
        setLinkedSet((prev) => new Set([...prev, ticket.id]));
      }
    } finally {
      setCreatingFor(null);
    }
  }

  return (
    <div className="space-y-6">

      {/* Status banner */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${connected ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/30'}`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${connected ? 'bg-primary/10' : 'bg-muted'}`}>
          {connected ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Zap className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{connected ? 'Connected to SupportCraft AI' : 'Not connected'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {connected ? 'API key configured. Tickets can create tasks automatically.' : 'Enter your SupportCraft API key below.'}
          </p>
        </div>
        {connected && (
          <a href="https://supportcraft.aakasa.dev" target="_blank" rel="noopener noreferrer"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors" title="Open SupportCraft">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* API credentials */}
      <SettingsSection title="API Credentials" description="Your SupportCraft API key authenticates all requests.">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sc-api-key">API Key</Label>
            <Input id="sc-api-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="sc_live_••••••••••••••••" autoComplete="off" />
            <p className="text-[11px] text-muted-foreground">
              Find your key in{' '}
              <a href="https://supportcraft.aakasa.dev/settings/api" target="_blank" rel="noopener noreferrer" className="underline">
                SupportCraft → Settings → API
              </a>. Use <code className="rounded bg-muted px-1">mock_demo</code> to test without a real account.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc-api-url">API URL <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="sc-api-url" type="url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://supportcraft.aakasa.dev/api/v1" />
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${testResult.ok ? 'border-primary/20 bg-primary/5 text-primary' : 'border-destructive/20 bg-destructive/5 text-destructive'}`}>
              {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
              {testResult.ok ? `Connected to "${testResult.name}"` : 'Connection failed — check your API key and URL'}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleTest} variant="outline" size="sm" disabled={!apiKey || isTesting}>
              {isTesting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Test Connection
            </Button>
            <Button onClick={handleSave} size="sm" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Webhook */}
      {connected && (
        <SettingsSection title="Webhook" description="Configure this URL in SupportCraft so it can automatically push ticket events to TaskCraft.">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <input readOnly value={webhookUrl} className={`${inputCls} font-mono text-xs`} />
                <Button variant="outline" size="sm" onClick={handleCopyWebhook} className="shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Webhook Secret</Label>
              <div className="flex gap-2">
                <input
                  readOnly
                  type={secretVisible ? 'text' : 'password'}
                  value={webhookSecret}
                  className={`${inputCls} font-mono text-xs`}
                />
                <Button variant="outline" size="sm" onClick={() => setSecretVisible((v) => !v)} className="shrink-0">
                  {secretVisible ? 'Hide' : 'Show'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleRegen} disabled={isRegen} className="shrink-0">
                  {isRegen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Copy this into SupportCraft as the webhook signing secret. Regenerating it will break existing webhook deliveries.</p>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* Behaviour options */}
      {connected && (
        <SettingsSection title="Behaviour" description="Control how SupportCraft tickets interact with TaskCraft tasks.">
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCreateTasks}
                onChange={(e) => setAutoCreateTasks(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded"
              />
              <div>
                <p className="text-sm font-medium">Auto-create task on new ticket</p>
                <p className="text-xs text-muted-foreground mt-0.5">When SupportCraft creates a new ticket via webhook, automatically create a linked task.</p>
              </div>
            </label>

            {autoCreateTasks && (
              <div className="space-y-1.5 pl-7">
                <Label>Default project for auto-created tasks</Label>
                <select
                  value={defaultProjectId}
                  onChange={(e) => setDefaultProjectId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">No project (inbox)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={syncStatusBack}
                onChange={(e) => setSyncStatusBack(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded"
              />
              <div>
                <p className="text-sm font-medium">Sync task status back to ticket</p>
                <p className="text-xs text-muted-foreground mt-0.5">When a task's status changes (e.g. to Done), update the linked SupportCraft ticket status automatically.</p>
              </div>
            </label>

            <Button onClick={handleSave} size="sm" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save Options
            </Button>
          </div>
        </SettingsSection>
      )}

      {/* Recent tickets */}
      {connected && (
        <SettingsSection title="Recent Tickets" description="Browse open support tickets and manually create linked tasks.">
          {tickets === null ? (
            <Button variant="outline" size="sm" onClick={handleLoadTickets} disabled={isLoadTix}>
              {isLoadTix ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Load Recent Tickets
            </Button>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open tickets found.</p>
          ) : (
            <div className="space-y-2">
              {tickets.map((ticket) => {
                const isLinked  = linkedSet.has(ticket.id);
                const isCreating = creatingFor === ticket.id;

                return (
                  <div key={ticket.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono text-muted-foreground">{ticket.number}</span>
                          <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold capitalize ${STATUS_STYLES[ticket.status] ?? ''}`}>
                            {ticket.status}
                          </span>
                          <span className={`text-[10px] font-semibold uppercase ${PRIORITY_STYLES[ticket.priority] ?? ''}`}>
                            {ticket.priority}
                          </span>
                        </div>
                        <p className="text-sm font-medium mt-0.5 truncate">{ticket.title}</p>
                        <p className="text-xs text-muted-foreground">{ticket.client_name}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <a href={ticket.url} target="_blank" rel="noopener noreferrer"
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>

                        {isLinked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            <Check className="h-2.5 w-2.5" />
                            Linked
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={projectFor[ticket.id] ?? ''}
                              onChange={(e) => setProjectFor((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                              className="rounded-lg border border-border bg-background px-1.5 py-1 text-xs outline-none"
                            >
                              <option value="">Project…</option>
                              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => handleCreateTask(ticket)}
                              disabled={isCreating}
                            >
                              {isCreating
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <><Plus className="h-3 w-3 mr-1" />Task</>
                              }
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SettingsSection>
      )}

      {/* Disconnect */}
      {connected && (
        <SettingsSection title="Disconnect" description="Remove SupportCraft from this workspace. Existing ticket links are preserved.">
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/30 text-destructive hover:bg-destructive/5"
            onClick={handleDisconnect}
            disabled={isDisconn}
          >
            {isDisconn ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Unplug className="mr-1.5 h-3.5 w-3.5" />}
            Disconnect SupportCraft
          </Button>
        </SettingsSection>
      )}
    </div>
  );
}
