import { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Info,
  Plus,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { AppSection, Incident, Severity } from '../types/ops';

interface IncidentsViewProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident, target: AppSection) => void;
  onCreateIncident: (payload: {
    title: string;
    severity: Severity;
    service: string;
    environment: 'production' | 'staging' | 'canary';
    description: string;
    logs: string;
    relatedFile: string;
    codeBefore: string;
  }) => Promise<void>;
}

const SEVERITIES: Array<'All' | Severity> = ['All', 'Critical', 'High', 'Medium', 'Low'];

function SeverityLabel({ severity }: { severity: Severity }) {
  if (severity === 'Critical') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400">
        <AlertOctagon className="w-3.5 h-3.5" />
        Critical
      </span>
    );
  }
  if (severity === 'High') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400">
        <ShieldAlert className="w-3.5 h-3.5" />
        High
      </span>
    );
  }
  if (severity === 'Medium') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
        <AlertTriangle className="w-3.5 h-3.5" />
        Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400">
      <Info className="w-3.5 h-3.5" />
      Low
    </span>
  );
}

export function IncidentsView({
  incidents,
  onSelectIncident,
  onCreateIncident,
}: IncidentsViewProps) {
  const [severityFilter, setSeverityFilter] = useState<'All' | Severity>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(incidents[0]?.id ?? '');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState<Severity>('High');
  const [newService, setNewService] = useState('payment-processor');
  const [newEnv, setNewEnv] = useState<'production' | 'staging' | 'canary'>('production');
  const [newFile, setNewFile] = useState('src/handlers/chargeCard.ts');
  const [newDesc, setNewDesc] = useState('');
  const [newLogs, setNewLogs] = useState('');
  const [newCode, setNewCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return incidents.filter((inc) => {
      if (severityFilter !== 'All' && inc.severity !== severityFilter) return false;
      if (!q) return true;
      return (
        inc.code.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.service.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q)
      );
    });
  }, [incidents, severityFilter, searchQuery]);

  const activeIncident =
    filtered.find((inc) => inc.id === selectedId) ?? filtered[0] ?? null;

  const handleSimulatePreset = () => {
    setNewTitle('Rate Limiter Null Dereference on Missing X-Forwarded-For Header');
    setNewSeverity('Critical');
    setNewService('edge-rate-limiter');
    setNewEnv('production');
    setNewFile('src/middleware/rateLimit.ts');
    setNewDesc(
      'Requests arriving from internal health checks without X-Forwarded-For crash middleware with TypeError: Cannot read properties of undefined (reading split).'
    );
    setNewLogs(
      `[2026-11-24T03:07:11.092Z] ERROR edge-rate-limiter: TypeError: Cannot read properties of undefined (reading 'split')
    at extractClientIp (src/middleware/rateLimit.ts:4:22)
    at rateLimitMiddleware (src/middleware/rateLimit.ts:14:18)
[2026-11-24T03:07:11.410Z] WARN  edge-rate-limiter: Pod readiness check returning HTTP 500`
    );
    setNewCode(
      `export function extractClientIp(headers: Record<string, string | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  const firstHop = forwarded.split(',')[0].trim();
  return firstHop || 'unknown';
}`
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;
    setSubmitting(true);
    try {
      await onCreateIncident({
        title: newTitle.trim(),
        severity: newSeverity,
        service: newService.trim() || 'core-api',
        environment: newEnv,
        description: newDesc.trim(),
        logs: newLogs.trim(),
        relatedFile: newFile.trim() || 'src/index.ts',
        codeBefore: newCode.trim(),
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewLogs('');
      setNewCode('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white">AI Incident Detection</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automatically detected failures across monitored services · Select an incident to
            diagnose or remediate
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Submit / Simulate Incident
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#0A1022] border border-slate-800/90 rounded-lg overflow-x-auto">
          {SEVERITIES.map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                severityFilter === sev
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ID, service, or error..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0A1022] border border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-100"
          />
        </div>
      </div>

      {/* Split Master-Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-[#0A1022] border border-slate-800/80 rounded-xl divide-y divide-slate-800/70">
          {filtered.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm text-slate-300">No incidents match your current filter.</p>
              <button
                type="button"
                onClick={() => {
                  setSeverityFilter('All');
                  setSearchQuery('');
                }}
                className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            filtered.map((inc) => {
              const isSelected = activeIncident?.id === inc.id;
              return (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => setSelectedId(inc.id)}
                  className={`w-full text-left p-4 transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-950/30' : 'hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2.5 text-xs">
                      <span className="font-mono font-semibold text-blue-300">{inc.code}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <SeverityLabel severity={inc.severity} />
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-400 font-mono">{inc.service}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-300">{inc.status}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">{inc.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{inc.description}</p>
                  <div className="mt-2 text-[11px] font-mono text-slate-500 tabular-nums">
                    Detected {inc.detectedAt} · {inc.environment}
                    {inc.isDemo ? ' · Sample' : ''}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail Inspector */}
        <div className="lg:col-span-5 bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-4">
          {activeIncident ? (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-blue-300">{activeIncident.code}</span>
                  <SeverityLabel severity={activeIncident.severity} />
                </div>
                <h3 className="text-base font-semibold text-white">{activeIncident.title}</h3>
                <p className="text-xs text-slate-400">
                  {activeIncident.service} · {activeIncident.environment} ·{' '}
                  {activeIncident.detectedAt}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-300">Error Description</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeIncident.description}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-300">Current Status</div>
                <div className="text-xs font-mono text-slate-200">
                  {activeIncident.status}
                  {activeIncident.relatedFile ? ` · ${activeIncident.relatedFile}` : ''}
                </div>
              </div>

              {activeIncident.logs && (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-300">Captured Log Tail</div>
                  <pre className="p-3 rounded-lg bg-[#050814] border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
                    {activeIncident.logs}
                  </pre>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectIncident(activeIncident, 'analysis')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Run AI Root Cause Analysis
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectIncident(activeIncident, 'fixes')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#070C1B] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Automated Fix
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Select an incident to inspect details.</p>
          )}
        </div>
      </div>

      {/* Create / Simulate Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0A1022] border border-slate-800 rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-bold text-white">
                  Submit Incident or Simulate Failure
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paste real application logs &amp; code to test live Gemini AI diagnostics.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSimulatePreset}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
              >
                Fill realistic failure sample
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-300">Incident Title</span>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Unhandled timeout in payment webhook"
                    className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-300">Affected Service</span>
                  <input
                    type="text"
                    required
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-300">Severity</span>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as Severity)}
                    className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-300">Environment</span>
                  <select
                    value={newEnv}
                    onChange={(e) =>
                      setNewEnv(e.target.value as 'production' | 'staging' | 'canary')
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="production">production</option>
                    <option value="staging">staging</option>
                    <option value="canary">canary</option>
                  </select>
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">Related Source File Path</span>
                <input
                  type="text"
                  value={newFile}
                  onChange={(e) => setNewFile(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs font-mono text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">Error Description</span>
                <textarea
                  required
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe the observed failure symptoms..."
                  className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">Error Logs</span>
                <textarea
                  rows={4}
                  value={newLogs}
                  onChange={(e) => setNewLogs(e.target.value)}
                  placeholder="Paste stack traces or server logs..."
                  className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs font-mono text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">Related Source Code</span>
                <textarea
                  rows={4}
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Paste relevant TypeScript/JavaScript function..."
                  className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs font-mono text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'Creating...' : 'Create Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
