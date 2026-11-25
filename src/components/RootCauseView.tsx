import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Code2,
  Loader2,
  Terminal,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { AiAnalysisResult, AppSection, Incident } from '../types/ops';

interface RootCauseViewProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  onUpdateAnalysis: (incidentId: string, analysis: AiAnalysisResult) => Promise<void>;
  onProceedToFix: (incident: Incident) => void;
  onNavigate: (section: AppSection) => void;
}

const ANALYSIS_PHASES = [
  'Reading application error logs & stack traces',
  'Correlating latency & resource saturation spikes',
  'Scanning related source code AST',
  'Matching against historical incident memory',
  'Synthesizing root cause & confidence score',
];

const FLOW_STAGES = [
  { x: 64, label: 'Error Logs' },
  { x: 196, label: 'Metrics' },
  { x: 328, label: 'Code AST' },
  { x: 460, label: 'Past Incidents' },
  { x: 592, label: 'Gemini RCA' },
];

export function RootCauseView({
  incidents,
  selectedIncident,
  onSelectIncident,
  onUpdateAnalysis,
  onProceedToFix,
}: RootCauseViewProps) {
  const active = selectedIncident ?? incidents[0] ?? null;
  const [analyzing, setAnalyzing] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>(null);

  useEffect(() => {
    setAnalysisResult(null);
    setError(null);
  }, [active?.id]);

  useEffect(() => {
    if (!analyzing) return;
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % ANALYSIS_PHASES.length);
    }, 900);
    return () => clearInterval(interval);
  }, [analyzing]);

  const handleRunAiAnalysis = async () => {
    if (!active) return;
    setAnalyzing(true);
    setPhaseIndex(0);
    setError(null);

    try {
      const historical = incidents
        .filter((i) => i.id !== active.id && i.status === 'Resolved')
        .map((i) => ({ code: i.code, title: i.title, rootCause: i.rootCause }));

      const res = await fetch('/api/ai/analyze-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident: active,
          logs: active.logs,
          codeSnippet: active.codeBefore,
          historicalIncidents: historical,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI root cause analysis request failed.');
      }

      setAnalysisResult(data as AiAnalysisResult);
      await onUpdateAnalysis(active.id, data as AiAnalysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete AI analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!active) {
    return (
      <div className="bg-[#0A1022] border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400">
        No incidents available for analysis.
      </div>
    );
  }

  const displayedRootCause = analysisResult?.rootCause ?? active.rootCause;
  const displayedSolution = analysisResult?.recommendedSolution ?? active.recommendedSolution;
  const displayedConfidence = analysisResult?.confidence ?? active.confidence ?? 0;
  const displayedReasons = analysisResult?.possibleReasons ?? [
    'Missing defensive cleanup or guard clause along exception path',
    'Burst concurrency exceeding resource/connection limits',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white">AI Root Cause Analysis</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Live server-side Gemini diagnostic reasoning across logs, code, and historical incidents
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={active.id}
            onChange={(e) => {
              const found = incidents.find((i) => i.id === e.target.value);
              if (found) onSelectIncident(found);
            }}
            className="px-3 py-2 rounded-lg bg-[#0A1022] border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
          >
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.code} — {inc.title.slice(0, 48)}
              </option>
            ))}
          </select>

          <motion.button
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            disabled={analyzing}
            onClick={handleRunAiAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold transition-all disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {analyzing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <BrainCircuit className="w-4 h-4" />
            )}
            {analyzing ? 'Analyzing with AI...' : 'Run Live AI Diagnosis'}
          </motion.button>
        </div>
      </div>

      {/* 2D Animated Diagnostic Signal Flow */}
      <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-4">
        <svg viewBox="0 0 656 76" className="w-full h-20 select-none">
          <line
            x1={64}
            y1={30}
            x2={592}
            y2={30}
            stroke="rgba(148,163,184,0.18)"
            strokeWidth={2}
          />
          <line
            x1={64}
            y1={30}
            x2={592}
            y2={30}
            stroke={analyzing ? '#8B5CF6' : '#3B82F6'}
            strokeWidth={2.2}
            className={analyzing ? 'animate-dash-flow-fast' : 'animate-dash-flow'}
          />

          {FLOW_STAGES.map((st, idx) => {
            const activeNode = analyzing ? idx === phaseIndex : Boolean(displayedRootCause);
            return (
              <g key={st.label}>
                {analyzing && idx === phaseIndex && (
                  <circle
                    cx={st.x}
                    cy={30}
                    r={18}
                    fill="rgba(139,92,246,0.28)"
                    className="animate-pulse-expand"
                    style={{ transformOrigin: `${st.x}px 30px` }}
                  />
                )}
                <circle
                  cx={st.x}
                  cy={30}
                  r={12}
                  fill={activeNode ? '#131D3F' : '#070C1B'}
                  stroke={activeNode ? '#60A5FA' : '#334155'}
                  strokeWidth={2}
                />
                <circle cx={st.x} cy={30} r={4} fill={activeNode ? '#60A5FA' : '#475569'} />
                <text
                  x={st.x}
                  y={62}
                  textAnchor="middle"
                  className={`text-[10px] font-medium ${
                    activeNode ? 'fill-slate-100' : 'fill-slate-400'
                  }`}
                >
                  {st.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/80 text-xs text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-rose-100">AI Analysis Error</div>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Animated AI Pipeline Progress */}
      {analyzing && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0A1022] border border-blue-500/40 rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-300">Autonomous Investigation Running</span>
            <span className="font-mono text-slate-400 tabular-nums">
              Step {phaseIndex + 1}/{ANALYSIS_PHASES.length}
            </span>
          </div>
          <div className="space-y-2">
            {ANALYSIS_PHASES.map((label, idx) => {
              const done = idx < phaseIndex;
              const current = idx === phaseIndex;
              return (
                <div key={label} className="flex items-center gap-2.5 text-xs">
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : current ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                  )}
                  <span className={current ? 'text-white font-medium' : 'text-slate-400'}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Logs & Related Code */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Terminal className="w-4 h-4 text-rose-400" />
                <span>Error Logs</span>
              </div>
              <span className="text-xs font-mono text-slate-400">{active.service}</span>
            </div>
            <pre className="p-3.5 rounded-lg bg-[#050814] border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed whitespace-pre-wrap">
              {active.logs || 'No log entries captured for this incident.'}
            </pre>
          </div>

          <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Code2 className="w-4 h-4 text-blue-400" />
                <span>Related Code Section</span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {active.relatedFile || 'src/handler.ts'}
              </span>
            </div>
            <pre className="p-3.5 rounded-lg bg-[#050814] border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed">
              {(active.codeBefore || '// Source snippet not attached').split('\n').map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-6 text-right text-slate-600 select-none tabular-nums">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>

        {/* Right: Root Cause, Possible Reasons, Recommended Solution, Confidence */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-white">Identified Root Cause</h3>
              <div className="text-right">
                <div className="text-xs text-slate-400">AI Confidence</div>
                <div className="text-lg font-display font-bold text-blue-400 tabular-nums">
                  {displayedConfidence > 0 ? `${displayedConfidence}%` : 'Pending'}
                </div>
              </div>
            </div>

            {displayedConfidence > 0 && (
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.min(1, Math.max(0, displayedConfidence / 100)) }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: 'left' }}
                  className="h-full w-full bg-gradient-to-r from-blue-500 to-violet-500"
                />
              </div>
            )}

            <p className="text-sm text-slate-200 leading-relaxed">
              {displayedRootCause ||
                'Click "Run Live AI Diagnosis" to analyze logs and source code with Gemini.'}
            </p>

            {analysisResult?.reasoningSteps && analysisResult.reasoningSteps.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-medium text-slate-300">Diagnostic Reasoning Trace</div>
                <ol className="space-y-1.5 text-xs text-slate-400 list-decimal list-inside">
                  {analysisResult.reasoningSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="text-xs font-medium text-slate-300">Possible Contributing Reasons</div>
              <ul className="space-y-1.5 text-xs text-slate-400 list-disc list-inside">
                {displayedReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-[#070C1B] border border-slate-800/80 space-y-1.5">
              <div className="text-xs font-semibold text-blue-300">Recommended Solution</div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {displayedSolution ||
                  'Run AI diagnosis to synthesize a concrete engineering remediation plan.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-[11px] font-mono text-slate-500">
                {analysisResult?.modelUsed
                  ? `Model: ${analysisResult.modelUsed}`
                  : active.isDemo
                  ? 'Baseline sample diagnosis · Run Live AI Diagnosis for Gemini analysis'
                  : 'Ready for live AI diagnosis'}
              </span>
              <button
                type="button"
                onClick={() => onProceedToFix(active)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Automated Fixes
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
