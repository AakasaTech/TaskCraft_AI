'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Key, Plus, Trash2, Copy, Check, Eye, EyeOff, Loader2,
  Webhook, AlertTriangle, ExternalLink, ToggleLeft, ToggleRight,
  Code2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SettingsSection, SettingsRow } from '@/components/shared/SettingsSection';
import { createApiKey, revokeApiKey, createWebhook, deleteWebhook, toggleWebhook } from '../actions';
import type { ApiKey, Webhook as WebhookType, ApiScope, WebhookEventType } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={handleCopy} className="ml-1.5 rounded p-1 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

const SCOPE_LABELS: Record<ApiScope, string> = {
  read:  'Read — list and fetch resources',
  write: 'Write — create and update resources',
  admin: 'Admin — manage API keys and webhooks',
};

const ALL_EVENTS: { value: WebhookEventType; label: string }[] = [
  { value: 'task.created',            label: 'task.created' },
  { value: 'task.updated',            label: 'task.updated' },
  { value: 'task.completed',          label: 'task.completed' },
  { value: 'project.created',         label: 'project.created' },
  { value: 'project.completed',       label: 'project.completed' },
  { value: 'time_entry.created',      label: 'time_entry.created' },
  { value: 'invoice.created',         label: 'invoice.created' },
  { value: 'support_ticket.linked',   label: 'support_ticket.linked' },
];

// ── API Keys section ──────────────────────────────────────────────────────────

function NewKeyReveal({ keyValue, onDismiss }: { keyValue: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs font-medium text-foreground">
          Copy this key now — it will never be shown again.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
        <span className="flex-1 truncate">{visible ? keyValue : '•'.repeat(Math.min(keyValue.length, 48))}</span>
        <button onClick={() => setVisible(!visible)} className="shrink-0 text-muted-foreground hover:text-foreground">
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <CopyButton text={keyValue} />
      </div>
      <button onClick={onDismiss} className="tc-btn-secondary w-full text-xs">
        I&apos;ve saved this key
      </button>
    </div>
  );
}

// ── Webhook section ───────────────────────────────────────────────────────────

function WebhookSecretReveal({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs font-medium">Signing secret — copy now, not shown again.</p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
        <span className="flex-1 truncate">{secret}</span>
        <CopyButton text={secret} />
      </div>
      <button onClick={onDismiss} className="tc-btn-secondary w-full text-xs">I&apos;ve saved the secret</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  apiKeys:  ApiKey[];
  webhooks: WebhookType[];
  plan:     string;
}

export function ApiKeysClient({ apiKeys: initialKeys, webhooks: initialWebhooks, plan }: Props) {
  const [keys,     setKeys]     = useState<ApiKey[]>(initialKeys);
  const [webhooks, setWebhooks] = useState<WebhookType[]>(initialWebhooks);

  // New key form
  const [showNewKey,   setShowNewKey]   = useState(false);
  const [newKeyName,   setNewKeyName]   = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<ApiScope[]>(['read']);
  const [revealedKey,  setRevealedKey]  = useState<string | null>(null);
  const [keyPending,   startKeyTransition]  = useTransition();

  // New webhook form
  const [showNewWh,    setShowNewWh]    = useState(false);
  const [whName,       setWhName]       = useState('');
  const [whUrl,        setWhUrl]        = useState('');
  const [whEvents,     setWhEvents]     = useState<WebhookEventType[]>([]);
  const [revealedSec,  setRevealedSec]  = useState<string | null>(null);
  const [whPending,    startWhTransition]   = useTransition();

  const isSoloPlusPlan = ['solo', 'team'].includes(plan);

  function toggleScope(scope: ApiScope) {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  function toggleEvent(event: WebhookEventType) {
    setWhEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) { toast.error('Enter a key name.'); return; }
    if (!newKeyScopes.length) { toast.error('Select at least one scope.'); return; }
    startKeyTransition(async () => {
      const res = await createApiKey(newKeyName, newKeyScopes);
      if (res.error) { toast.error(res.error); return; }
      const { key, ...keyData } = res.data!;
      setKeys((prev) => [keyData as ApiKey, ...prev]);
      setRevealedKey(key);
      setShowNewKey(false);
      setNewKeyName('');
      setNewKeyScopes(['read']);
    });
  }

  async function handleRevoke(id: string) {
    startKeyTransition(async () => {
      const res = await revokeApiKey(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success('API key revoked.');
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    });
  }

  async function handleCreateWebhook() {
    if (!whUrl.trim()) { toast.error('Enter a URL.'); return; }
    if (!whEvents.length) { toast.error('Select at least one event.'); return; }
    startWhTransition(async () => {
      const res = await createWebhook({ name: whName, url: whUrl, events: whEvents });
      if (res.error) { toast.error(res.error); return; }
      const { secret, ...whData } = res.data!;
      setWebhooks((prev) => [whData as WebhookType, ...prev]);
      setRevealedSec(secret);
      setShowNewWh(false);
      setWhName(''); setWhUrl(''); setWhEvents([]);
    });
  }

  async function handleDeleteWebhook(id: string) {
    startWhTransition(async () => {
      const res = await deleteWebhook(id);
      if (res.error) toast.error(res.error);
      else {
        toast.success('Webhook deleted.');
        setWebhooks((prev) => prev.filter((w) => w.id !== id));
      }
    });
  }

  async function handleToggleWebhook(id: string, current: boolean) {
    setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, active: !current } : w));
    const res = await toggleWebhook(id, !current);
    if (res.error) {
      toast.error(res.error);
      setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, active: current } : w));
    }
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-6">
      {/* API reference callout */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <Code2 className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Public API v1</p>
          <p className="text-xs text-muted-foreground">Base URL: <code className="font-mono">{appUrl}/api/v1</code></p>
        </div>
        <a
          href="/api/v1/projects"
          target="_blank"
          rel="noopener noreferrer"
          className="tc-btn-secondary text-xs inline-flex items-center gap-1.5 shrink-0"
        >
          Explore <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* API Keys */}
      <SettingsSection
        title="API Keys"
        description="Use API keys to authenticate requests from your scripts and integrations."
        footer={
          !showNewKey ? (
            <button onClick={() => setShowNewKey(true)} className="tc-btn-primary inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New API key
            </button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {/* Revealed key */}
          {revealedKey && (
            <NewKeyReveal keyValue={revealedKey} onDismiss={() => setRevealedKey(null)} />
          )}

          {/* New key form */}
          {showNewKey && (
            <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New API Key</p>
              <div>
                <label className="text-xs font-medium mb-1 block">Name</label>
                <Input
                  placeholder="e.g. My integration"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-2">Scopes</p>
                <div className="space-y-2">
                  {(Object.keys(SCOPE_LABELS) as ApiScope[]).map((scope) => (
                    <label key={scope} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        className="rounded border-border"
                      />
                      <span className="text-xs">{SCOPE_LABELS[scope]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateKey} disabled={keyPending} className="tc-btn-primary text-xs inline-flex items-center gap-1.5">
                  {keyPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Key className="h-3 w-3" />}
                  Generate key
                </button>
                <button onClick={() => { setShowNewKey(false); setNewKeyName(''); setNewKeyScopes(['read']); }} className="tc-btn-secondary text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Keys list */}
          {keys.length === 0 && !showNewKey ? (
            <p className="text-sm text-muted-foreground py-2">No API keys yet.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 py-3 first:pt-0">
                  <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{k.key_prefix}…</p>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {(k.scopes as ApiScope[]).map((s) => (
                        <span key={s} className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold capitalize">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">
                      {k.last_used_at
                        ? `Used ${new Date(k.last_used_at).toLocaleDateString()}`
                        : 'Never used'}
                    </p>
                    <button
                      onClick={() => handleRevoke(k.id)}
                      disabled={keyPending}
                      className="mt-1 text-[10px] text-destructive hover:underline"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Webhooks */}
      <SettingsSection
        title="Webhooks"
        description="Receive HTTP POST events when things happen in your workspace."
        footer={
          !showNewWh ? (
            <button onClick={() => setShowNewWh(true)} className="tc-btn-primary inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add webhook
            </button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {/* Revealed secret */}
          {revealedSec && (
            <WebhookSecretReveal secret={revealedSec} onDismiss={() => setRevealedSec(null)} />
          )}

          {/* New webhook form */}
          {showNewWh && (
            <div className="rounded-xl border border-border p-4 space-y-4 bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New Webhook</p>
              <div>
                <label className="text-xs font-medium mb-1 block">Name (optional)</label>
                <Input placeholder="e.g. Slack alerts" value={whName} onChange={(e) => setWhName(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Payload URL</label>
                <Input placeholder="https://example.com/webhook" value={whUrl} onChange={(e) => setWhUrl(e.target.value)} className="text-sm" />
              </div>
              <div>
                <p className="text-xs font-medium mb-2">Events</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_EVENTS.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whEvents.includes(value)}
                        onChange={() => toggleEvent(value)}
                        className="rounded border-border"
                      />
                      <span className="text-xs font-mono">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateWebhook} disabled={whPending} className="tc-btn-primary text-xs inline-flex items-center gap-1.5">
                  {whPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Webhook className="h-3 w-3" />}
                  Create webhook
                </button>
                <button onClick={() => { setShowNewWh(false); setWhName(''); setWhUrl(''); setWhEvents([]); }} className="tc-btn-secondary text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Webhooks list */}
          {webhooks.length === 0 && !showNewWh ? (
            <p className="text-sm text-muted-foreground py-2">No webhooks yet.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {webhooks.map((wh) => (
                <div key={wh.id} className="flex items-start gap-3 py-3 first:pt-0">
                  <Webhook className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{wh.name}</p>
                      <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${wh.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {wh.active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{wh.url}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(wh.events as WebhookEventType[]).map((e) => (
                        <span key={e} className="rounded-full bg-muted px-1.5 py-px text-[10px] font-mono">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleWebhook(wh.id, wh.active)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={wh.active ? 'Pause' : 'Activate'}
                    >
                      {wh.active
                        ? <ToggleRight className="h-5 w-5 text-primary" />
                        : <ToggleLeft className="h-5 w-5" />
                      }
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(wh.id)}
                      disabled={whPending}
                      className="text-destructive/60 hover:text-destructive transition-colors"
                      title="Delete webhook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
