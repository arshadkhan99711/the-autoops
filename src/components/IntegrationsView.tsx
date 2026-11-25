import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  Container,
  GitBranch,
  KeyRound,
  Link2,
  Loader2,
  MessageSquare,
  Radar,
  ServerCog,
  X,
} from 'lucide-react';
import type { IntegrationItem } from '../types/ops';

interface IntegrationsViewProps {
  integrations: IntegrationItem[];
  isSignedIn: boolean;
  onSaveIntegration: (updated: IntegrationItem) => Promise<void>;
  onDisconnectIntegration: (integration: IntegrationItem) => Promise<void>;
  onRequireAuth: () => void;
}

function getProviderIcon(provider: string) {
  switch (provider) {
    case 'GitHub':
    case 'GitLab':
      return GitBranch;
    case 'Docker':
      return Container;
    case 'Kubernetes':
      return ServerCog;
    case 'Slack':
      return MessageSquare;
    case 'Datadog':
    case 'Prometheus':
      return Radar;
    default:
      return Cloud;
  }
}

export function IntegrationsView({
  integrations,
  isSignedIn,
  onSaveIntegration,
  onDisconnectIntegration,
  onRequireAuth,
}: IntegrationsViewProps) {
  const [editing, setEditing] = useState<IntegrationItem | null>(null);
  const [accountLabel, setAccountLabel] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [secretToken, setSecretToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = (item: IntegrationItem) => {
    setEditing(item);
    setAccountLabel(item.status === 'Connected' ? item.accountLabel : '');
    setEndpointUrl(item.endpointUrl ?? '');
    setSecretToken('');
    setError(null);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setVerifying(true);
    setError(null);

    try {
      const res = await fetch('/api/integrations/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: editing.provider,
          accountLabel: accountLabel.trim(),
          endpointUrl: endpointUrl.trim(),
          secretToken: secretToken.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Integration verification failed.');
      }

      await onSaveIntegration({
        ...editing,
        status: 'Connected',
        accountLabel: data.accountLabel,
        endpointUrl: data.endpointUrl || undefined,
        credentialFingerprint: data.credentialFingerprint,
        lastSyncAt: new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC',
      });

      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect integration.');
    } finally {
      setVerifying(false);
    }
  };

  const connectedCount = integrations.filter((i) => i.status === 'Connected').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Integrations &amp; Connectors</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Unconnected services explicitly display sample demo data · Credentials are encrypted
            server-side using AES-256-GCM before storing fingerprints
          </p>
        </div>
        <div className="text-xs font-mono text-slate-300 tabular-nums">
          {connectedCount} / {integrations.length} Connected
        </div>
      </div>

      {!isSignedIn && (
        <div className="p-4 rounded-xl bg-[#0A1022] border border-blue-500/30 flex flex-wrap items-center justify-between gap-4 text-xs">
          <span className="text-slate-300">
            Sign in to persist encrypted integration connections across sessions in Firestore.
          </span>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
          >
            Sign In to Connect
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {integrations.map((item) => {
          const Icon = getProviderIcon(item.provider);
          const isConnected = item.status === 'Connected';

          return (
            <div
              key={item.id}
              className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#070C1B] border border-slate-800 flex items-center justify-center text-blue-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{item.provider}</h3>
                      <div className="text-[11px] text-slate-400">{item.category}</div>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isConnected ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>

                <div className="text-[11px] font-mono text-slate-400 space-y-1 pt-1">
                  <div className="truncate">Target: {item.accountLabel}</div>
                  {item.credentialFingerprint && (
                    <div className="text-emerald-300/90 truncate">
                      Key: {item.credentialFingerprint}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/70">
                <span className="text-[11px] text-slate-500 truncate">
                  {item.lastSyncAt ?? 'Demo Data'}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {isConnected && (
                    <button
                      type="button"
                      onClick={() => onDisconnectIntegration(item)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      Disconnect
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openModal(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {isConnected ? 'Configure' : 'Connect'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Secure Integration Auth Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0A1022] border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-bold text-white">
                  Connect {editing.provider}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Credentials are encrypted server-side and validated against SSRF rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-3.5">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">
                  Organization / Cluster / Workspace Name
                </span>
                <input
                  type="text"
                  required
                  value={accountLabel}
                  onChange={(e) => setAccountLabel(e.target.value)}
                  placeholder={`e.g. acme-${editing.provider.toLowerCase().replace(/\s+/g, '-')}`}
                  className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">
                  Webhook / API Endpoint URL (HTTPS)
                </span>
                <input
                  type="url"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="https://api.example.com/webhooks/autoops"
                  className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs font-mono text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">
                  API Token / Service Secret
                </span>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={secretToken}
                    onChange={(e) => setSecretToken(e.target.value)}
                    placeholder="Enter token (encrypted server-side)"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs font-mono text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </label>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Raw tokens are never stored in browser state or Firestore documents.</span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
                >
                  {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Verify &amp; Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
