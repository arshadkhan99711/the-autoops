import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  FileText,
  FlaskConical,
  Loader2,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  AiPatchResult,
  Incident,
  IncidentReportData,
  IntegrationItem,
  TestRunResult,
  UserRole,
} from '../types/ops';

interface AutomatedFixesViewProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  integrations: IntegrationItem[];
  userRole: UserRole;
  userDisplayName: string;
  onSavePatch: (incidentId: string, codeAfter: string, explanation: string) => Promise<void>;
  onRecordDeployment: (params: {
    incident: Incident;
    status: 'Dry Run Verified' | 'Deployed' | 'Rolled Back' | 'Failed';
    testPassedCount: number;
    testTotalCount: number;
    verifiedByBackend: boolean;
    notes: string;
  }) => Promise<void>;
  onRollbackIncident: (incidentId: string) => Promise<void>;
}

export function AutomatedFixesView({
  incidents,
  selectedIncident,
  onSelectIncident,
  integrations,
  userRole,
  userDisplayName,
  onSavePatch,
  onRecordDeployment,
  onRollbackIncident,
}: AutomatedFixesViewProps) {
  const active = selectedIncident ?? incidents[0] ?? null;

  const [patchResult, setPatchResult] = useState<AiPatchResult | null>(null);
  const [showDiffReview, setShowDiffReview] = useState(true);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);
  const [approved, setApproved] = useState(false);
  const [deployMessage, setDeployMessage] = useState<{
    type: 'dry_run' | 'deployed' | 'error';
    text: string;
  } | null>(null);
  const [report, setReport] = useState<IncidentReportData | null>(null);

  const [loadingPatch, setLoadingPatch] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [loadingDeploy, setLoadingDeploy] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPatchResult(null);
    setTestResult(null);
    setApproved(false);
    setDeployMessage(null);
    setReport(null);
    setError(null);
  }, [active?.id]);

  if (!active) {
    return (
      <div className="bg-[#0A1022] border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400">
        No incidents available for patch synthesis.
      </div>
    );
  }

  const canApproveAndDeploy = userRole === 'admin' || userRole === 'operator';
  const currentCodeAfter = patchResult?.codeAfter ?? active.codeAfter ?? '';
  const connectedDeployTarget = integrations.find(
    (int) =>
      int.status === 'Connected' &&
      int.supportsDeployTarget &&
      Boolean(int.endpointUrl?.trim())
  );

  const handleGenerateFix = async () => {
    setLoadingPatch(true);
    setError(null);
    setTestResult(null);
    setApproved(false);
    setDeployMessage(null);
    try {
      const res = await fetch('/api/ai/generate-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident: active,
          rootCause: active.rootCause,
          codeBefore: active.codeBefore,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Patch synthesis failed.');

      const result = data as AiPatchResult;
      setPatchResult(result);
      setShowDiffReview(true);
      await onSavePatch(active.id, result.codeAfter, result.patchExplanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate code fix.');
    } finally {
      setLoadingPatch(false);
    }
  };

  const handleRunTests = async () => {
    if (!currentCodeAfter.trim()) {
      setError('Generate or select a code fix before running tests.');
      return;
    }
    setLoadingTests(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/run-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeBefore: active.codeBefore,
          codeAfter: currentCodeAfter,
          relatedFile: active.relatedFile,
          testCases: patchResult?.testCases ?? [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test suite failed to execute.');
      setTestResult(data as TestRunResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test runner error.');
    } finally {
      setLoadingTests(false);
    }
  };

  const handleApproveFix = () => {
    if (!canApproveAndDeploy) {
      setError('Your current RBAC role (Viewer) cannot approve production fixes.');
      return;
    }
    setApproved(true);
    setError(null);
  };

  const handleDeployFix = async () => {
    if (!approved) {
      setError('Human approval is required before deployment.');
      return;
    }
    setLoadingDeploy(true);
    setError(null);
    setDeployMessage(null);
    try {
      const res = await fetch('/api/ops/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentCode: active.code,
          service: active.service,
          patchTitle: active.title,
          approvalConfirmed: approved,
          approvedByName: userDisplayName,
          connectedIntegration: connectedDeployTarget ?? null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setDeployMessage({ type: 'error', text: data.message || data.error || 'Deployment failed.' });
        await onRecordDeployment({
          incident: active,
          status: 'Failed',
          testPassedCount: testResult?.passedCount ?? 0,
          testTotalCount: testResult?.totalCount ?? 0,
          verifiedByBackend: false,
          notes: data.message || 'Deployment failed.',
        });
        return;
      }

      if (data.deployed && data.verifiedByBackend) {
        setDeployMessage({ type: 'deployed', text: data.message });
        await onRecordDeployment({
          incident: active,
          status: 'Deployed',
          testPassedCount: testResult?.passedCount ?? 0,
          testTotalCount: testResult?.totalCount ?? 0,
          verifiedByBackend: true,
          notes: data.message,
        });
      } else {
        setDeployMessage({ type: 'dry_run', text: data.message });
        await onRecordDeployment({
          incident: active,
          status: 'Dry Run Verified',
          testPassedCount: testResult?.passedCount ?? 0,
          testTotalCount: testResult?.totalCount ?? 0,
          verifiedByBackend: false,
          notes: data.message,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment dispatch failed.');
    } finally {
      setLoadingDeploy(false);
    }
  };

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/incident-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident: active,
          deployment: {
            approved,
            verifiedByBackend: deployMessage?.type === 'deployed',
            note: deployMessage?.text ?? 'Sandbox dry-run only',
          },
          testSummary: testResult
            ? `${testResult.passedCount}/${testResult.totalCount} checks passed`
            : 'Not run yet',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate incident report.');
      setReport(data as IncidentReportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incident report generation failed.');
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Automated Fixes &amp; Rollout</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synthesize patches, compare before/after diffs, run sandbox tests, and enforce human
            approval before deployment
          </p>
        </div>

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
      </div>

      {/* 2D Animated Patch Remediation Pipeline */}
      <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-4">
        <svg viewBox="0 0 656 76" className="w-full h-20 select-none">
          <line x1={64} y1={30} x2={592} y2={30} stroke="rgba(148,163,184,0.18)" strokeWidth={2} />
          <line
            x1={64}
            y1={30}
            x2={592}
            y2={30}
            stroke={deployMessage?.type === 'deployed' ? '#34D399' : '#3B82F6'}
            strokeWidth={2.2}
            className={loadingPatch || loadingTests || loadingDeploy ? 'animate-dash-flow-fast' : 'animate-dash-flow'}
          />
          {[
            { x: 64, label: 'Synthesize', done: Boolean(currentCodeAfter), busy: loadingPatch },
            { x: 196, label: 'Review Diff', done: Boolean(currentCodeAfter) && showDiffReview, busy: false },
            { x: 328, label: 'Run Tests', done: Boolean(testResult?.allPassed), busy: loadingTests },
            { x: 460, label: 'Human Gate', done: approved, busy: false },
            { x: 592, label: 'Rollout', done: Boolean(deployMessage), busy: loadingDeploy },
          ].map((node) => (
            <g key={node.label}>
              {node.busy && (
                <circle
                  cx={node.x}
                  cy={30}
                  r={18}
                  fill="rgba(59,130,246,0.28)"
                  className="animate-pulse-expand"
                  style={{ transformOrigin: `${node.x}px 30px` }}
                />
              )}
              <circle
                cx={node.x}
                cy={30}
                r={12}
                fill={node.done ? '#0E2925' : '#070C1B'}
                stroke={node.done ? '#34D399' : node.busy ? '#60A5FA' : '#334155'}
                strokeWidth={2}
              />
              <circle
                cx={node.x}
                cy={30}
                r={4}
                fill={node.done ? '#34D399' : node.busy ? '#60A5FA' : '#475569'}
              />
              <text
                x={node.x}
                y={62}
                textAnchor="middle"
                className={`text-[10px] font-medium ${
                  node.done ? 'fill-emerald-300' : 'fill-slate-400'
                }`}
              >
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Action Control Bar */}
      <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={loadingPatch}
            onClick={handleGenerateFix}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold transition-all disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loadingPatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate Fix
          </button>

          <button
            type="button"
            onClick={() => setShowDiffReview((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#070C1B] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Code2 className="w-3.5 h-3.5" />
            Review Code
          </button>

          <button
            type="button"
            disabled={loadingTests || !currentCodeAfter}
            onClick={handleRunTests}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#070C1B] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loadingTests ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
            Run Tests
          </button>

          <button
            type="button"
            disabled={!canApproveAndDeploy || !currentCodeAfter || approved}
            onClick={handleApproveFix}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              approved
                ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                : 'bg-[#070C1B] hover:bg-slate-800 border border-slate-700 text-slate-100 disabled:opacity-50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {approved ? 'Approved' : 'Approve Fix'}
          </button>

          <button
            type="button"
            disabled={loadingDeploy || !approved}
            onClick={handleDeployFix}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loadingDeploy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
            Deploy Fix
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loadingReport}
            onClick={handleGenerateReport}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loadingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            Incident Report
          </button>

          {(active.status === 'Deployed' || active.status === 'Resolved') && (
            <button
              type="button"
              onClick={() => onRollbackIncident(active.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-rose-800/80 text-rose-300 hover:bg-rose-950/40 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rollback
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-xs text-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {deployMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-2.5 ${
            deployMessage.type === 'deployed'
              ? 'bg-emerald-950/40 border-emerald-700/70 text-emerald-200'
              : deployMessage.type === 'dry_run'
              ? 'bg-amber-950/40 border-amber-700/70 text-amber-200'
              : 'bg-rose-950/40 border-rose-800/70 text-rose-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">
              {deployMessage.type === 'deployed'
                ? 'Connected Backend Deployment Confirmed'
                : deployMessage.type === 'dry_run'
                ? 'Sandbox Dry-Run Verification Only (Not Pushed to Live Prod)'
                : 'Deployment Verification Failed'}
            </div>
            <p className="mt-1 leading-relaxed">{deployMessage.text}</p>
          </div>
        </div>
      )}

      {/* Patch Explanation */}
      <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white">
            {active.code} · {active.relatedFile || 'src/handler.ts'}
          </div>
          <span className="text-xs text-slate-400">
            Deployment target:{' '}
            <span className="text-slate-200 font-medium">
              {connectedDeployTarget
                ? `${connectedDeployTarget.provider} (${connectedDeployTarget.accountLabel})`
                : 'None connected (sandbox dry-run mode)'}
            </span>
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {patchResult?.patchExplanation ??
            active.recommendedSolution ??
            'Click "Generate Fix" to synthesize an automated code patch with Gemini.'}
        </p>
      </div>

      {/* Before and After Code Comparison */}
      {showDiffReview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-rose-300">Before (Current Faulty Code)</span>
              <span className="font-mono text-slate-500">{active.relatedFile}</span>
            </div>
            <pre className="p-3.5 rounded-lg bg-[#050814] border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
              {active.codeBefore || '// No baseline code snippet provided'}
            </pre>
          </div>

          <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-300">After (AI Proposed Patch)</span>
              <span className="font-mono text-slate-500">
                {patchResult ? `Risk: ${patchResult.riskLevel}` : 'Proposed diff'}
              </span>
            </div>
            <pre className="p-3.5 rounded-lg bg-[#050814] border border-slate-800 text-[11px] font-mono text-emerald-200/95 overflow-x-auto leading-relaxed">
              {currentCodeAfter || '// Click "Generate Fix" to synthesize patched source code.'}
            </pre>
          </div>
        </div>
      )}

      {/* Verification Test Results */}
      {testResult && (
        <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              Automated Verification Suite ({testResult.passedCount}/{testResult.totalCount} passed)
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Mode: {testResult.executionMode}
            </span>
          </div>

          <div className="divide-y divide-slate-800/60">
            {testResult.checks.map((chk, idx) => (
              <div key={idx} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span
                    className={`font-semibold mr-2 ${
                      chk.status === 'passed' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    [{chk.status.toUpperCase()}]
                  </span>
                  <span className="text-slate-200 font-medium">{chk.name}</span>
                  <p className="text-slate-400 mt-0.5">{chk.detail}</p>
                </div>
                <span className="font-mono text-slate-500 tabular-nums">{chk.durationMs}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post-Mortem Incident Report */}
      {report && (
        <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-display font-bold text-white">
              Post-Mortem Incident Report · {active.code}
            </h3>
            <span className="text-xs font-mono text-slate-400">Generated by The Autoops</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-semibold text-blue-300">Executive Summary</div>
              <p className="text-slate-300 leading-relaxed">{report.executiveSummary}</p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-blue-300">Impact Assessment</div>
              <p className="text-slate-300 leading-relaxed">{report.impactAssessment}</p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-blue-300">Root Cause</div>
              <p className="text-slate-300 leading-relaxed">{report.rootCauseSummary}</p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-blue-300">Remediation Action</div>
              <p className="text-slate-300 leading-relaxed">{report.remediationAction}</p>
            </div>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-slate-800/70 text-xs">
            <div className="font-semibold text-slate-200">Preventive Follow-Ups</div>
            <ul className="list-disc list-inside text-slate-400 space-y-1">
              {report.preventiveMeasures.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
