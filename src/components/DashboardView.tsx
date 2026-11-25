import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { SERVER_NODES, TELEMETRY_SERIES } from '../data/sampleData';
import type {
  AppSection,
  AuditLogEntry,
  Incident,
  LiveBackendTelemetry,
} from '../types/ops';
import { AutonomousTopology2D } from './AutonomousTopology2D';
import { TelemetryCharts } from './TelemetryCharts';

interface DashboardViewProps {
  incidents: Incident[];
  auditLogs: AuditLogEntry[];
  liveTelemetry: LiveBackendTelemetry | null;
  connectedIntegrationCount: number;
  onSelectIncident: (incident: Incident, target: AppSection) => void;
  onNavigate: (section: AppSection) => void;
}

export function DashboardView({
  incidents,
  auditLogs,
  liveTelemetry,
  connectedIntegrationCount,
  onSelectIncident,
  onNavigate,
}: DashboardViewProps) {
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '6h' | '24h'>('15m');
  const [topologyStage, setTopologyStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTopologyStage((prev) => (prev + 1) % 4);
    }, 3400);
    return () => clearInterval(timer);
  }, []);

  const activeIncidents = incidents.filter(
    (inc) => inc.status !== 'Resolved' && inc.status !== 'Rolled Back'
  );
  const resolvedIncidents = incidents.filter((inc) => inc.status === 'Resolved');
  const criticalCount = activeIncidents.filter((inc) => inc.severity === 'Critical').length;
  const featuredIncident = activeIncidents[0] ?? incidents[0];

  const latestPoint = TELEMETRY_SERIES[timeframe][TELEMETRY_SERIES[timeframe].length - 1];

  return (
    <div className="space-y-6">
      {/* Top Workspace Banner: Honest Data Source Disclosure */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 rounded-xl bg-[#0A1022] border border-slate-800/80 text-xs">
        <div className="flex flex-wrap items-center gap-3 text-slate-300">
          <span className="font-medium text-blue-300">
            {connectedIntegrationCount > 0
              ? `${connectedIntegrationCount} live integration${connectedIntegrationCount > 1 ? 's' : ''} connected`
              : 'Sample cluster telemetry active'}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">
            {liveTelemetry
              ? `Live backend runtime: CPU ${liveTelemetry.cpuPct}% · Mem ${liveTelemetry.usedMemPct}% · Event loop lag ${liveTelemetry.eventLoopLagMs}ms`
              : 'Connecting to live backend runtime telemetry...'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('integrations')}
          className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Configure Connectors
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'System Health Status',
            icon: ShieldCheck,
            iconClass: 'text-blue-400',
            value: criticalCount > 0 ? 'Degraded' : 'Nominal',
            sub:
              criticalCount > 0
                ? `${criticalCount} critical issue under active remediation`
                : 'All monitored services operating within SLO',
          },
          {
            label: 'Active Incidents',
            icon: AlertTriangle,
            iconClass: 'text-amber-400',
            value: String(activeIncidents.length),
            sub: `${activeIncidents.filter((i) => i.status === 'Awaiting Approval').length} awaiting human approval`,
          },
          {
            label: 'Resolved Incidents',
            icon: CheckCircle2,
            iconClass: 'text-emerald-400',
            value: String(resolvedIncidents.length),
            sub: 'Avg resolution: 8.9 min · Verified fixes',
          },
          {
            label: 'API P95 & Error Rate',
            icon: Activity,
            iconClass: 'text-sky-400',
            value: `${latestPoint.latencyMs}ms / ${latestPoint.errorRate}%`,
            sub: `CPU ${latestPoint.cpu}% · Memory ${latestPoint.memory}% (sample)`,
          },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.25, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[#0A1022] border border-slate-800/80 hover:border-slate-700 rounded-xl p-5 space-y-2 transition-colors"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{kpi.label}</span>
                <Icon className={`w-4 h-4 ${kpi.iconClass}`} />
              </div>
              <div className="text-2xl font-display font-bold text-white tabular-nums">
                {kpi.value}
              </div>
              <p className="text-xs text-slate-400 tabular-nums">{kpi.sub}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Live 2D Service Topology & Anomaly Map */}
      <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              Live 2D Cluster Topology &amp; Auto-Remediation Stream
            </h3>
            <p className="text-xs text-slate-400">
              Real-time 2D request packet flow, anomaly shockwaves, and autonomous patch dispatch
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-[#070C1B] border border-slate-800 rounded-lg">
            {(['Detect', 'Diagnose', 'Patch', 'Verified'] as const).map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setTopologyStage(idx)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  topologyStage === idx
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <AutonomousTopology2D
          activeStage={topologyStage}
          mode="dashboard"
          onNodeClick={(node) => {
            if (node.incidentCode) {
              const found = incidents.find((i) => i.code === node.incidentCode);
              if (found) onSelectIncident(found, 'analysis');
            }
          }}
        />
      </div>

      {/* Interactive Telemetry Charts */}
      <TelemetryCharts
        series={TELEMETRY_SERIES[timeframe]}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />

      {/* AI Root Cause Spotlight + Server Performance + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* AI Root Cause Highlight */}
        <div className="lg:col-span-5 bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-violet-300">
                Latest AI Root Cause Analysis
              </span>
              {featuredIncident?.confidence && (
                <span className="text-xs font-mono text-slate-300 tabular-nums">
                  Confidence {featuredIncident.confidence}%
                </span>
              )}
            </div>

            {featuredIncident ? (
              <>
                <div>
                  <div className="text-xs text-slate-400 font-mono">
                    {featuredIncident.code} · {featuredIncident.service} ·{' '}
                    {featuredIncident.severity}
                  </div>
                  <h3 className="text-base font-semibold text-white mt-1">
                    {featuredIncident.title}
                  </h3>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {featuredIncident.rootCause ?? featuredIncident.description}
                </p>

                {featuredIncident.recommendedSolution && (
                  <div className="p-3.5 rounded-lg bg-[#070C1B] border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                    <span className="font-semibold text-blue-300">Recommended fix: </span>
                    {featuredIncident.recommendedSolution}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">No active incidents detected.</p>
            )}
          </div>

          {featuredIncident && (
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onSelectIncident(featuredIncident, 'analysis')}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Inspect AI Analysis
              </button>
              <button
                type="button"
                onClick={() => onSelectIncident(featuredIncident, 'fixes')}
                className="px-3.5 py-2 rounded-lg bg-[#070C1B] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Review Automated Fix
              </button>
            </div>
          )}
        </div>

        {/* Server Performance Table */}
        <div className="lg:col-span-7 bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <h3 className="text-base font-semibold text-white">Server Node Performance</h3>
            </div>
            <span className="text-xs text-slate-400">Sample fleet · 4 nodes</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Node</th>
                  <th className="py-2.5 pr-4 font-medium">Workload</th>
                  <th className="py-2.5 pr-4 font-medium text-right">CPU</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Memory</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Latency</th>
                  <th className="py-2.5 font-medium text-right">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {SERVER_NODES.map((node) => (
                  <tr key={node.name} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 pr-4 font-mono text-slate-200">{node.name}</td>
                    <td className="py-3 pr-4 text-slate-400">{node.role}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-slate-200">
                      {node.cpu}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-slate-200">
                      {node.memory}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-slate-200">
                      {node.latency}
                    </td>
                    <td className="py-3 text-right font-medium">
                      <span
                        className={
                          node.status === 'Healthy'
                            ? 'text-emerald-400'
                            : node.status === 'Warning'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }
                      >
                        {node.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent Activity Feed */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-violet-400" />
                <span>Recent Autonomous &amp; Operator Activity</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                View Audit Trail
              </button>
            </div>
            <div className="space-y-2">
              {auditLogs.slice(0, 3).map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs py-1.5"
                >
                  <div className="text-slate-300">
                    <span className="font-mono text-blue-300">{entry.action}</span>
                    <span className="text-slate-500 mx-2">·</span>
                    <span>{entry.details}</span>
                  </div>
                  <span className="font-mono text-slate-500 tabular-nums shrink-0">
                    {entry.timestampLabel ?? 'Just now'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
