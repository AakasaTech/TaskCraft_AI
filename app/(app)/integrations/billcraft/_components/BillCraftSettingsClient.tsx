'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Unplug, ExternalLink, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection } from '@/components/shared/SettingsSection';
import {
  saveBillCraftSettings,
  testBillCraftConnection,
  syncBillCraftClients,
  syncBillCraftProjects,
  disconnectBillCraft,
} from '../actions';

interface Props {
  connected:          boolean;
  apiKey:             string;
  apiUrl:             string;
  lastClientSync:     string | null;
  lastProjectSync:    string | null;
}

function SyncRow({
  label,
  lastSync,
  onSync,
  loading,
}: {
  label:    string;
  lastSync: string | null;
  onSync:   () => void;
  loading:  boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {lastSync
            ? `Last synced ${new Date(lastSync).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
            : 'Never synced'}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onSync} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        <span className="ml-1.5">Sync now</span>
      </Button>
    </div>
  );
}

export function BillCraftSettingsClient({
  connected,
  apiKey:     initialKey,
  apiUrl:     initialUrl,
  lastClientSync,
  lastProjectSync,
}: Props) {
  const router = useRouter();
  const [apiKey,   setApiKey]   = useState(initialKey);
  const [apiUrl,   setApiUrl]   = useState(initialUrl || 'https://app.billcraft.ai/api');
  const [testResult, setTestResult] = useState<{ ok: boolean; name?: string } | null>(null);

  const [isSaving,      startSave]      = useTransition();
  const [isTesting,     startTest]      = useTransition();
  const [isSyncClients, startSyncCli]   = useTransition();
  const [isSyncProjects,startSyncProj]  = useTransition();
  const [isDisconnecting, startDisconn] = useTransition();

  function handleSave() {
    startSave(async () => {
      const res = await saveBillCraftSettings({ api_key: apiKey, api_url: apiUrl });
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Settings saved');
        router.refresh();
      }
    });
  }

  function handleTest() {
    setTestResult(null);
    startTest(async () => {
      const res = await testBillCraftConnection();
      if ('ok' in res && res.ok) {
        setTestResult({ ok: true, name: res.workspace?.name });
        toast.success('Connection successful!');
      } else {
        setTestResult({ ok: false });
        toast.error('error' in res ? res.error : 'Connection failed');
      }
    });
  }

  function handleSyncClients() {
    startSyncCli(async () => {
      const res = await syncBillCraftClients();
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Synced ${res.data?.count} clients from BillCraft`);
        router.refresh();
      }
    });
  }

  function handleSyncProjects() {
    startSyncProj(async () => {
      const res = await syncBillCraftProjects();
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Synced ${res.data?.count} projects from BillCraft`);
        router.refresh();
      }
    });
  }

  function handleDisconnect() {
    startDisconn(async () => {
      const res = await disconnectBillCraft();
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('BillCraft disconnected');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">

      {/* Connection status banner */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${
        connected
          ? 'border-primary/20 bg-primary/5'
          : 'border-border bg-muted/30'
      }`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          connected ? 'bg-primary/10' : 'bg-muted'
        }`}>
          {connected
            ? <CheckCircle2 className="h-5 w-5 text-primary" />
            : <Zap className="h-5 w-5 text-muted-foreground" />
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {connected ? 'Connected to BillCraft AI' : 'Not connected'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {connected
              ? 'Your API key is configured and active.'
              : 'Enter your BillCraft API key below to connect.'}
          </p>
        </div>
        {connected && (
          <a
            href="https://app.billcraft.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Open BillCraft"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* API credentials */}
      <SettingsSection title="API Credentials" description="Your BillCraft API key is used to authenticate requests. Keep it secret.">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="bc_live_••••••••••••••••"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Find your API key in{' '}
              <a href="https://app.billcraft.ai/settings/api" target="_blank" rel="noopener noreferrer" className="underline">
                BillCraft → Settings → API
              </a>
              . Use <code className="rounded bg-muted px-1">mock_demo</code> to test without a real account.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-url">API URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="api-url"
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://app.billcraft.ai/api"
            />
            <p className="text-[11px] text-muted-foreground">Leave as default unless you are self-hosting BillCraft.</p>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              testResult.ok
                ? 'border-primary/20 bg-primary/5 text-primary'
                : 'border-destructive/20 bg-destructive/5 text-destructive'
            }`}>
              {testResult.ok
                ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                : <XCircle className="h-3.5 w-3.5 shrink-0" />
              }
              {testResult.ok
                ? `Connected to "${testResult.name}"`
                : 'Connection failed — check your API key and URL'}
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

      {/* Sync */}
      {connected && (
        <SettingsSection title="Data Sync" description="Pull the latest clients and projects from BillCraft so the invoice wizard stays up to date.">
          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            <SyncRow
              label="Clients"
              lastSync={lastClientSync}
              onSync={handleSyncClients}
              loading={isSyncClients}
            />
            <SyncRow
              label="Projects"
              lastSync={lastProjectSync}
              onSync={handleSyncProjects}
              loading={isSyncProjects}
            />
          </div>
        </SettingsSection>
      )}

      {/* Danger zone */}
      {connected && (
        <SettingsSection title="Disconnect" description="Remove your BillCraft API key from this workspace. Invoice history is preserved.">
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/30 text-destructive hover:bg-destructive/5"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Unplug className="mr-1.5 h-3.5 w-3.5" />
            }
            Disconnect BillCraft
          </Button>
        </SettingsSection>
      )}
    </div>
  );
}
