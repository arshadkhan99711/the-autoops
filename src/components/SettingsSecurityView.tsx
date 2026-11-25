import { useState } from 'react';
import { CheckCircle2, KeyRound, Lock, LogOut, Shield, UserCheck } from 'lucide-react';
import type {
  AuditLogEntry,
  DeploymentRecord,
  UserPrivateAccount,
  UserProfile,
} from '../types/ops';

interface SettingsSecurityViewProps {
  profile: UserProfile | null;
  privateAccount: UserPrivateAccount | null;
  isAuthenticated: boolean;
  hasSession?: boolean;
  auditLogs: AuditLogEntry[];
  deployments: DeploymentRecord[];
  onUpdateProfile: (updates: {
    displayName: string;
    jobTitle: string;
    notificationsEnabled: boolean;
    autoApproveLowRisk: boolean;
  }) => Promise<void>;
  onSignOut: () => Promise<void>;
  onRequireAuth: () => void;
}

export function SettingsSecurityView({
  profile,
  privateAccount,
  isAuthenticated,
  hasSession = false,
  auditLogs,
  deployments,
  onUpdateProfile,
  onSignOut,
  onRequireAuth,
}: SettingsSecurityViewProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? 'Principal SRE');
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? 'Site Reliability Engineer');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    privateAccount?.notificationsEnabled ?? true
  );
  const [autoApproveLowRisk, setAutoApproveLowRisk] = useState(
    privateAccount?.autoApproveLowRisk ?? false
  );
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }
    setSaving(true);
    setSavedNotice(false);
    try {
      await onUpdateProfile({
        displayName: displayName.trim() || 'Engineer',
        jobTitle: jobTitle.trim() || 'SRE Operator',
        notificationsEnabled,
        autoApproveLowRisk,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold text-white">
          Profile, Settings &amp; Security Controls
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage operator preferences, RBAC permissions, deployment history, and immutable audit logs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User Profile & Settings Form */}
        <div className="lg:col-span-6 bg-[#0A1022] border border-slate-800/80 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden border border-slate-700 shrink-0 bg-[#070C1B]">
                {!avatarFailed ? (
                  <img
                    src="/src/assets/images/avatar_lead_sre_1795518682295.jpg"
                    alt="Operator profile avatar"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <UserCheck className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  {profile?.displayName ?? 'Guest Operator'}
                </h3>
                <p className="text-xs text-slate-400">
                  {privateAccount?.email ?? 'Sign in to sync profile'} · Role:{' '}
                  <span className="font-mono text-blue-300 uppercase">
                    {profile?.role ?? 'viewer'}
                  </span>
                </p>
              </div>
            </div>

            {(isAuthenticated || hasSession) && (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#070C1B] hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700/70 text-xs font-medium text-slate-200 hover:text-rose-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Log Out
              </button>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="p-4 rounded-lg bg-[#070C1B] border border-slate-800 space-y-3 text-xs">
              <p className="text-slate-300">
                Sign in with Google or email/password to save your operator profile and workspace
                security settings.
              </p>
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold cursor-pointer"
              >
                Sign In / Create Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-300">Display Name</span>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-300">Job Title</span>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#050814] border border-slate-800 text-xs text-slate-100 focus:border-blue-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-slate-200">
                      Critical Incident Escalation Alerts
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Notify connected Slack/email channels when severity is Critical or High
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                    className="mt-1 accent-blue-600"
                  />
                </label>

                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-slate-200">
                      Require Human Approval Before Production Deploy
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Enforced by backend policy; disabling only affects staging low-risk sandboxes
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!autoApproveLowRisk}
                    onChange={(e) => setAutoApproveLowRisk(!e.target.checked)}
                    className="mt-1 accent-blue-600"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between pt-2">
                {savedNotice ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Settings saved to Firestore
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security & RBAC Safeguards */}
        <div className="lg:col-span-6 bg-[#0A1022] border border-slate-800/80 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <h3 className="text-base font-semibold text-white">Security Architecture &amp; RBAC</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-lg bg-[#070C1B] border border-slate-800/80 flex items-start gap-3">
              <KeyRound className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-200">Encrypted Integration Credentials</div>
                <p className="text-slate-400 mt-0.5">
                  Tokens are encrypted server-side with AES-256-GCM and screened against SSRF
                  private-network ranges. Only masked fingerprints persist in Firestore.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-[#070C1B] border border-slate-800/80 flex items-start gap-3">
              <Lock className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-200">
                  Human Approval &amp; Rollback Enforcement
                </div>
                <p className="text-slate-400 mt-0.5">
                  Production rollouts require explicit operator sign-off and backend target
                  confirmation. Every deployed patch supports one-click rollback.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <div className="text-xs font-medium text-slate-300 mb-2">Role Permissions Matrix</div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">AI Diagnosis</th>
                  <th className="py-2 pr-3 font-medium">Approve &amp; Deploy</th>
                  <th className="py-2 font-medium">Integrations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr>
                  <td className="py-2 pr-3 font-mono text-blue-300">admin</td>
                  <td className="py-2 pr-3">Full</td>
                  <td className="py-2 pr-3">Full + Rollback</td>
                  <td className="py-2">Full</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-mono text-violet-300">operator</td>
                  <td className="py-2 pr-3">Full</td>
                  <td className="py-2 pr-3">Approve &amp; Rollback</td>
                  <td className="py-2">Connect / View</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3 font-mono text-slate-400">viewer</td>
                  <td className="py-2 pr-3">Read-only</td>
                  <td className="py-2 pr-3">Denied</td>
                  <td className="py-2">Read-only</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Deployment History & Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Deployment &amp; Rollback History</h3>
          <div className="divide-y divide-slate-800/70">
            {deployments.map((dep) => (
              <div key={dep.id} className="py-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-blue-300">
                    {dep.incidentCode} · {dep.service}
                  </span>
                  <span
                    className={`font-medium ${
                      dep.status === 'Deployed'
                        ? 'text-emerald-400'
                        : dep.status === 'Dry Run Verified'
                        ? 'text-amber-300'
                        : 'text-rose-400'
                    }`}
                  >
                    {dep.status}
                  </span>
                </div>
                <div className="text-slate-200">{dep.patchTitle}</div>
                <div className="text-slate-400">
                  {dep.verificationNotes} · Approved by {dep.approvedByName ?? 'Operator'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Immutable Security Audit Logs</h3>
          <div className="divide-y divide-slate-800/70 max-h-80 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 text-xs space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-violet-300">{log.action}</span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    {log.timestampLabel ?? 'Synced'}
                  </span>
                </div>
                <div className="text-slate-300">{log.details}</div>
                <div className="text-[11px] font-mono text-slate-500">
                  Target: {log.targetType}/{log.targetId} · Role: {log.actorRole}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
