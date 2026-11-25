import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileCode2,
  GitPullRequest,
  Lock,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { AppSection } from '../types/ops';
import { AutonomousOps3D } from './AutonomousOps3D';
import { BrandLogo } from './BrandLogo';

interface LandingPageProps {
  onExploreDashboard: () => void;
  onGetStarted: () => void;
  onNavigateSection: (section: AppSection) => void;
  isAuthenticated: boolean;
}

const PIPELINE_STEPS = [
  {
    id: 'monitor',
    label: '01. Continuous Monitoring',
    detail: 'Streaming application logs, container metrics, and API P95 latencies.',
    metric: '14,200 events/s ingested',
  },
  {
    id: 'diagnose',
    label: '02. Root Cause Isolation',
    detail: 'Correlating stack traces against source AST and prior incident memory.',
    metric: 'pgPool.connect() leak isolated',
  },
  {
    id: 'patch',
    label: '03. Patch Synthesis',
    detail: 'Generating minimal before/after diffs with automated regression checks.',
    metric: 'try/finally release guard verified',
  },
  {
    id: 'verify',
    label: '04. Human-Gated Rollout',
    detail: 'Running sandbox verification and awaiting operator approval before deploy.',
    metric: 'Rollback safety envelope active',
  },
];

const CAPABILITIES = [
  {
    icon: Activity,
    color: 'text-blue-400',
    title: '01. Real-Time Anomaly Detection',
    body: 'Tracks CPU, memory, P95 latency, and error-rate spikes across production services and clusters before customers notice degradation.',
  },
  {
    icon: Terminal,
    color: 'text-violet-400',
    title: '02. AI Root Cause Analysis',
    body: 'Reads raw stack traces, inspects the exact fault line in source code, and surfaces confidence-scored hypotheses backed by historical incidents.',
  },
  {
    icon: FileCode2,
    color: 'text-sky-400',
    title: '03. Before & After Code Patches',
    body: 'Synthesizes minimal, idiomatic code diffs and explains every modified branch so engineers can audit fixes in seconds.',
  },
  {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    title: '04. Automated Verification Suite',
    body: 'Compiles patched modules, checks static security invariants, and runs regression assertions before requesting deployment approval.',
  },
  {
    icon: ShieldCheck,
    color: 'text-blue-400',
    title: '05. Human Approval & RBAC',
    body: 'Production deployments remain gated behind authorized operator sign-off, immutable audit logs, and one-click rollback support.',
  },
  {
    icon: GitPullRequest,
    color: 'text-violet-400',
    title: '06. Full DevOps Ecosystem',
    body: 'Connects with GitHub, GitLab, Docker, Kubernetes, AWS, Google Cloud, Azure, Slack, Datadog, and Prometheus with encrypted credentials.',
  },
];

export function LandingPage({
  onExploreDashboard,
  onGetStarted,
  onNavigateSection,
  isAuthenticated,
}: LandingPageProps) {
  const [activeStage, setActiveStage] = useState(0);
  const [meshImgFailed, setMeshImgFailed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % PIPELINE_STEPS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 overflow-x-hidden">
      {/* Clean 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#050814]/95 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => onNavigateSection('home')}
            className="inline-flex items-center gap-2.5 text-lg font-display font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BrandLogo size={26} />
            <span>The Autoops</span>
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a
              href="#capabilities"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#architecture"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
            <button
              type="button"
              onClick={() => onNavigateSection('dashboard')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('integrations')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Integrations
            </button>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onExploreDashboard}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isAuthenticated ? 'Open Console' : 'Explore Dashboard'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-14 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 flex flex-col justify-center space-y-6"
          >
            <p className="text-sm font-medium text-blue-400 tracking-wide">
              The Autoops · Your AI Engineer That Never Sleeps.
            </p>

            <h1
              className="font-display font-bold text-white tracking-tight leading-[1.08]"
              style={{ fontSize: 'clamp(2.25rem, 4.3vw, 3.75rem)', textWrap: 'balance' }}
            >
              Software Operations. On Autopilot.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              AI that monitors, diagnoses, fixes, and verifies software failures — so your team can
              focus on building instead of firefighting.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={onGetStarted}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={onExploreDashboard}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0B1226] hover:bg-[#111B36] border border-slate-700/80 text-slate-100 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Explore Dashboard
              </motion.button>
            </div>

            {/* Quiet Proof Strip */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-800/80">
              <div>
                <div className="text-xl font-semibold text-white tabular-nums">&lt; 45s</div>
                <div className="text-xs text-slate-400">Median log-to-RCA diagnosis</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-white tabular-nums">10+</div>
                <div className="text-xs text-slate-400">Cloud &amp; CI/CD connectors</div>
              </div>
              <div>
                <div className="text-xl font-semibold text-white tabular-nums">100%</div>
                <div className="text-xs text-slate-400">Human-gated prod deploys</div>
              </div>
            </div>
          </motion.div>

          {/* 3D Animated Autonomous Operations Engine */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 flex flex-col justify-between bg-[#0A1022] border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <AutonomousOps3D
              activeStage={activeStage}
              onSelectNode={() => onExploreDashboard()}
            />

            {/* Live Animated 4-Stage Sequencer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PIPELINE_STEPS.map((step, idx) => {
                const isActive = idx === activeStage;
                return (
                  <motion.button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStage(idx)}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.16 }}
                    className={`relative text-left p-3.5 rounded-xl border transition-colors cursor-pointer overflow-hidden ${
                      isActive
                        ? 'bg-blue-950/40 border-blue-500/60'
                        : 'bg-[#070C1B] border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-xs font-semibold ${
                          isActive ? 'text-blue-300' : 'text-slate-300'
                        }`}
                      >
                        {step.label}
                      </span>
                      {isActive && (
                        <motion.span
                          layoutId="stage-active-indicator"
                          className="text-[11px] font-mono text-violet-300"
                        >
                          Active
                        </motion.span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{step.detail}</p>
                    <div className="mt-2 text-[11px] font-mono text-slate-300 truncate">
                      {step.metric}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="capabilities" className="border-t border-slate-800/80 bg-[#070B18]">
        <div className="max-w-7xl mx-auto px-6 py-20 space-y-12">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Autonomous engineering from alert to verified fix
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Every failure triggers a deterministic investigation pipeline: log ingestion, source
              correlation, historical matching, diff generation, and human-approved rollout.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CAPABILITIES.map((cap, idx) => {
              const Icon = cap.icon;
              return (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.28, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-[#0A1022] border border-slate-800/80 hover:border-blue-500/40 rounded-xl p-6 space-y-3 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#070C1B] border border-slate-800 flex items-center justify-center animate-float-2d">
                    <Icon className={`w-4 h-4 ${cap.color}`} />
                  </div>
                  <h3 className="text-base font-semibold text-white">{cap.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{cap.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 relative bg-[#0A1022] border border-slate-800/80 rounded-2xl overflow-hidden">
            {!meshImgFailed ? (
              <img
                src="/src/assets/images/architecture_node_mesh_1795518682388.jpg"
                alt="Distributed microservice telemetry and verification topology"
                referrerPolicy="no-referrer"
                onError={() => setMeshImgFailed(true)}
                className="w-full h-full min-h-[280px] object-cover"
              />
            ) : (
              <div className="w-full h-full min-h-[280px] flex items-center justify-center bg-gradient-to-br from-[#0B1430] to-[#080C1B]">
                <Cpu className="w-12 h-12 text-blue-400/70" />
              </div>
            )}
            <div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-blue-500/20 to-transparent animate-scan-beam pointer-events-none" />
          </div>

          <div className="lg:col-span-5 flex flex-col justify-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Built for honest, verifiable operations
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              The Autoops never fabricates deployment confirmations. When an external CI/CD or cluster
              target is connected, patches dispatch over signed HTTPS webhooks. Without a live
              target, verification runs transparently in sandbox dry-run mode.
            </p>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <span>AES-256-GCM server-side credential envelopes and SSRF-hardened probes</span>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                <span>Role-based access control separating Viewers, SRE Operators, and Admins</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Activity className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
                <span>Immutable audit trail for every AI diagnosis, approval, and rollback</span>
              </li>
            </ul>
            <div className="pt-2">
              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={onExploreDashboard}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Launch Interactive Console
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </section>

      {/* Final Brand Footer */}
      <footer className="border-t border-slate-800/80 bg-[#040610]">
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2.5 text-lg font-display font-bold text-white">
              <BrandLogo size={24} />
              <span>The Autoops</span>
            </div>
            <p className="text-sm text-slate-400">
              Let AI handle the incidents. Let humans build the future.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => onNavigateSection('dashboard')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('incidents')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Incidents
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('integrations')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Integrations
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('settings')}
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Security &amp; RBAC
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
