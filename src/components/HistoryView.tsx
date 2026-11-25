import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, RotateCcw, Search } from 'lucide-react';
import type { DeploymentRecord, Incident, Severity } from '../types/ops';

interface HistoryViewProps {
  incidents: Incident[];
  deployments: DeploymentRecord[];
  onInspectIncident: (incident: Incident) => void;
}

export function HistoryView({ incidents, deployments, onInspectIncident }: HistoryViewProps) {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'All' | Severity>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Resolved' | 'Deployed' | 'Rolled Back'>('All');

  const historicalIncidents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return incidents.filter((inc) => {
      const isHistorical =
        inc.status === 'Resolved' || inc.status === 'Deployed' || inc.status === 'Rolled Back';
      if (!isHistorical) return false;
      if (severityFilter !== 'All' && inc.severity !== severityFilter) return false;
      if (statusFilter !== 'All' && inc.status !== statusFilter) return false;
      if (!q) return true;
      return (
        inc.code.toLowerCase().includes(q) ||
        inc.title.toLowerCase().includes(q) ||
        inc.service.toLowerCase().includes(q) ||
        (inc.rootCause ?? '').toLowerCase().includes(q)
      );
    });
  }, [incidents, search, severityFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Incident History</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Searchable archive of past failures, root causes, applied solutions, resolution times,
            and verification results
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search root cause or service..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0A1022] border border-slate-800 focus:border-blue-500 focus:outline-none text-xs text-slate-100"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#0A1022] border border-slate-800 rounded-lg">
          {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                severityFilter === sev
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#0A1022] border border-slate-800 rounded-lg">
          {(['All', 'Resolved', 'Deployed', 'Rolled Back'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === st
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Historical Incidents Table/List */}
      <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl divide-y divide-slate-800/70">
        {historicalIncidents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No resolved or historical incidents match the selected filters.
          </div>
        ) : (
          historicalIncidents.map((inc) => {
            const dep = deployments.find((d) => d.incidentId === inc.id);
            return (
              <div key={inc.id} className="p-5 space-y-3 hover:bg-slate-900/30 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span className="font-mono font-semibold text-blue-300">{inc.code}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-slate-300 font-medium">{inc.severity}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="font-mono text-slate-400">{inc.service}</span>
                    {inc.isDemo && (
                      <>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-500">Sample</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs tabular-nums">
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {inc.resolutionMinutes ? `${inc.resolutionMinutes} min` : 'Recorded'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        inc.status === 'Rolled Back' ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {inc.status === 'Rolled Back' ? (
                        <RotateCcw className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      {inc.status}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-white">{inc.title}</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                  <div>
                    <span className="font-medium text-slate-400">Root Cause: </span>
                    <span className="text-slate-300">{inc.rootCause ?? inc.description}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-400">Solution Applied: </span>
                    <span className="text-slate-300">
                      {inc.recommendedSolution ?? 'Patched via automated fix workflow'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <span className="text-slate-400">
                    Verification:{' '}
                    <span className="text-slate-200">
                      {dep
                        ? `${dep.status} (${dep.testPassedCount ?? 0}/${dep.testTotalCount ?? 0} checks · ${
                            dep.verifiedByBackend ? 'Live Backend' : 'Sandbox Dry-Run'
                          })`
                        : 'Unit & syntax checks verified (sample)'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onInspectIncident(inc)}
                    className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                  >
                    Open Code &amp; Diagnosis
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
