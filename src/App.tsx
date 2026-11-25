import { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  History,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PlugZap,
  Settings,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AuthModal } from './components/AuthModal';
import { AutomatedFixesView } from './components/AutomatedFixesView';
import { BrandLogo } from './components/BrandLogo';
import { DashboardView } from './components/DashboardView';
import { HistoryView } from './components/HistoryView';
import { IncidentsView } from './components/IncidentsView';
import { IntegrationsView } from './components/IntegrationsView';
import { LandingPage } from './components/LandingPage';
import { RootCauseView } from './components/RootCauseView';
import { SettingsSecurityView } from './components/SettingsSecurityView';
import {
  DEFAULT_INTEGRATIONS,
  DEMO_AUDIT_LOGS,
  DEMO_DEPLOYMENTS,
  DEMO_INCIDENTS,
} from './data/sampleData';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import type {
  AiAnalysisResult,
  AppSection,
  AuditLogEntry,
  DeploymentRecord,
  Incident,
  IntegrationItem,
  LiveBackendTelemetry,
  Severity,
  UserPrivateAccount,
  UserProfile,
} from './types/ops';

const BOOTSTRAP_ADMIN_EMAIL = 'arshadkhan99711@gmail.com';

const NAV_ITEMS: Array<{ id: AppSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'incidents', label: 'Incident Detection', icon: AlertTriangle },
  { id: 'analysis', label: 'Root Cause AI', icon: BrainCircuit },
  { id: 'fixes', label: 'Automated Fixes', icon: Wrench },
  { id: 'history', label: 'Incident History', icon: History },
  { id: 'integrations', label: 'Integrations', icon: PlugZap },
  { id: 'settings', label: 'Security & Settings', icon: Settings },
];

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean as Partial<T>;
}

export default function App() {
  const [section, setSection] = useState<AppSection>('home');
  const [sectionHistory, setSectionHistory] = useState<AppSection[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (next: AppSection) => {
    if (section === next) return;
    setSectionHistory((prev) => [...prev.slice(-19), section]);
    setSection(next);
  };

  const handleBack = () => {
    if (sectionHistory.length === 0) {
      setSection('home');
      return;
    }
    const previousSection = sectionHistory[sectionHistory.length - 1];
    setSectionHistory((prev) => prev.slice(0, -1));
    setSection(previousSection);
  };
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | 'forgot'>('login');

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateAccount, setPrivateAccount] = useState<UserPrivateAccount | null>(null);
  const [verificationSentNotice, setVerificationSentNotice] = useState(false);

  const [cloudIncidents, setCloudIncidents] = useState<Incident[]>([]);
  const [cloudIntegrations, setCloudIntegrations] = useState<IntegrationItem[]>([]);
  const [cloudDeployments, setCloudDeployments] = useState<DeploymentRecord[]>([]);
  const [cloudAuditLogs, setCloudAuditLogs] = useState<AuditLogEntry[]>([]);

  const [localIncidents, setLocalIncidents] = useState<Incident[]>(DEMO_INCIDENTS);
  const [localIntegrations, setLocalIntegrations] =
    useState<IntegrationItem[]>(DEFAULT_INTEGRATIONS);
  const [localDeployments, setLocalDeployments] =
    useState<DeploymentRecord[]>(DEMO_DEPLOYMENTS);
  const [localAuditLogs, setLocalAuditLogs] = useState<AuditLogEntry[]>(DEMO_AUDIT_LOGS);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(DEMO_INCIDENTS[0].id);
  const [liveTelemetry, setLiveTelemetry] = useState<LiveBackendTelemetry | null>(null);

  const isVerifiedUser = Boolean(firebaseUser && firebaseUser.emailVerified);

  // Poll live backend telemetry every 10 seconds
  useEffect(() => {
    let active = true;
    const fetchLive = async () => {
      try {
        const res = await fetch('/api/telemetry/live');
        if (res.ok && active) {
          const data = (await res.json()) as LiveBackendTelemetry;
          setLiveTelemetry(data);
        }
      } catch {
        // non-fatal telemetry poll
      }
    };
    void fetchLive();
    const timer = setInterval(fetchLive, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // Firebase Auth listener & profile provisioning
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);

      if (!user || !user.emailVerified) {
        setProfile(null);
        setPrivateAccount(null);
        setCloudIncidents([]);
        setCloudIntegrations([]);
        setCloudDeployments([]);
        setCloudAuditLogs([]);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        const isBootstrapAdmin = user.email === BOOTSTRAP_ADMIN_EMAIL;

        if (!snap.exists()) {
          const role = isBootstrapAdmin ? 'admin' : 'operator';
          const newProfile: UserProfile = {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Engineer',
            role,
            jobTitle: isBootstrapAdmin ? 'Principal Admin SRE' : 'SRE Operator',
          };
          await setDoc(userRef, {
            ...newProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await setDoc(doc(db, 'users', user.uid, 'private', 'account'), {
            uid: user.uid,
            email: user.email || '',
            notificationsEnabled: true,
            autoApproveLowRisk: false,
            updatedAt: serverTimestamp(),
          });

          if (isBootstrapAdmin) {
            await setDoc(doc(db, 'admins', user.uid), {
              uid: user.uid,
              grantedBy: 'system-bootstrap',
              createdAt: serverTimestamp(),
            });
          }

          setProfile(newProfile);
          setPrivateAccount({
            uid: user.uid,
            email: user.email || '',
            notificationsEnabled: true,
            autoApproveLowRisk: false,
          });
        } else {
          const data = snap.data() as UserProfile;
          setProfile(data);
          const privSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'account'));
          if (privSnap.exists()) {
            setPrivateAccount(privSnap.data() as UserPrivateAccount);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }
    });

    return () => unsub();
  }, []);

  // Firestore Real-time Subscriptions for Verified Users
  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified) return;

    const uid = firebaseUser.uid;

    const unsubIncidents = onSnapshot(
      query(collection(db, 'incidents'), where('ownerId', '==', uid)),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as Incident);
        setCloudIncidents(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'incidents')
    );

    const unsubIntegrations = onSnapshot(
      query(collection(db, 'integrations'), where('ownerId', '==', uid)),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as IntegrationItem);
        setCloudIntegrations(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'integrations')
    );

    const unsubDeployments = onSnapshot(
      query(collection(db, 'deployments'), where('ownerId', '==', uid)),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as DeploymentRecord);
        setCloudDeployments(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'deployments')
    );

    const unsubAudit = onSnapshot(
      query(collection(db, 'auditLogs'), where('ownerId', '==', uid)),
      (snap) => {
        const items = snap.docs.map((d) => d.data() as AuditLogEntry);
        setCloudAuditLogs(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );

    return () => {
      unsubIncidents();
      unsubIntegrations();
      unsubDeployments();
      unsubAudit();
    };
  }, [authReady, firebaseUser]);

  // Combine cloud data with demo baseline cleanly
  const incidents = useMemo(() => {
    if (!isVerifiedUser) return localIncidents;
    const map = new Map<string, Incident>();
    for (const demo of DEMO_INCIDENTS) map.set(demo.id, demo);
    for (const cloud of cloudIncidents) map.set(cloud.id, cloud);
    return Array.from(map.values());
  }, [isVerifiedUser, localIncidents, cloudIncidents]);

  const integrations = useMemo(() => {
    if (!isVerifiedUser) return localIntegrations;
    return DEFAULT_INTEGRATIONS.map((base) => {
      const override = cloudIntegrations.find((c) => c.provider === base.provider);
      return override
        ? {
            ...base,
            ...override,
            description: base.description,
            supportsDeployTarget: base.supportsDeployTarget,
          }
        : base;
    });
  }, [isVerifiedUser, localIntegrations, cloudIntegrations]);

  const deployments = useMemo(() => {
    if (!isVerifiedUser) return localDeployments;
    return [...cloudDeployments, ...DEMO_DEPLOYMENTS];
  }, [isVerifiedUser, localDeployments, cloudDeployments]);

  const auditLogs = useMemo(() => {
    if (!isVerifiedUser) return localAuditLogs;
    return [...cloudAuditLogs, ...DEMO_AUDIT_LOGS];
  }, [isVerifiedUser, localAuditLogs, cloudAuditLogs]);

  const selectedIncident =
    incidents.find((inc) => inc.id === selectedIncidentId) ?? incidents[0] ?? null;

  const appendAuditLog = async (
    action: string,
    targetType: string,
    targetId: string,
    details: string
  ) => {
    const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const nowLabel = new Date().toISOString().slice(11, 19) + ' UTC';
    if (isVerifiedUser && firebaseUser) {
      try {
        await setDoc(doc(db, 'auditLogs', id), {
          id,
          ownerId: firebaseUser.uid,
          actorUid: firebaseUser.uid,
          actorRole: profile?.role ?? 'operator',
          action,
          targetType,
          targetId,
          details: details.slice(0, 990),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `auditLogs/${id}`);
      }
    } else {
      setLocalAuditLogs((prev) => [
        {
          id,
          ownerId: 'demo',
          actorUid: 'demo',
          actorRole: 'operator',
          action,
          targetType,
          targetId,
          details,
          timestampLabel: nowLabel,
        },
        ...prev,
      ]);
    }
  };

  // Ensure demo incident exists in user's Firestore if they mutate it while signed in
  const ensureIncidentPersisted = async (inc: Incident): Promise<string> => {
    if (!isVerifiedUser || !firebaseUser) return inc.id;
    const userScopedId = inc.ownerId === firebaseUser.uid ? inc.id : `${inc.id}_${firebaseUser.uid.slice(0, 8)}`;
    const ref = doc(db, 'incidents', userScopedId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const payload = stripUndefined({
        id: userScopedId,
        ownerId: firebaseUser.uid,
        code: inc.code,
        title: inc.title,
        severity: inc.severity,
        status: inc.status,
        service: inc.service,
        environment: inc.environment,
        detectedAt: inc.detectedAt,
        resolvedAt: inc.resolvedAt,
        description: inc.description,
        logs: inc.logs,
        relatedFile: inc.relatedFile,
        codeBefore: inc.codeBefore,
        codeAfter: inc.codeAfter,
        rootCause: inc.rootCause,
        recommendedSolution: inc.recommendedSolution,
        confidence: inc.confidence,
        resolutionMinutes: inc.resolutionMinutes,
        isDemo: inc.isDemo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(ref, payload);
    }
    return userScopedId;
  };

  const handleCreateIncident = async (payload: {
    title: string;
    severity: Severity;
    service: string;
    environment: 'production' | 'staging' | 'canary';
    description: string;
    logs: string;
    relatedFile: string;
    codeBefore: string;
  }) => {
    const id = `inc_${Date.now()}`;
    const code = `INC-${Math.floor(4830 + Math.random() * 500)}`;
    const detectedAt = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';

    const newInc: Incident = {
      id,
      ownerId: isVerifiedUser && firebaseUser ? firebaseUser.uid : 'demo',
      code,
      title: payload.title,
      severity: payload.severity,
      status: 'Detected',
      service: payload.service,
      environment: payload.environment,
      detectedAt,
      description: payload.description,
      logs: payload.logs || undefined,
      relatedFile: payload.relatedFile || undefined,
      codeBefore: payload.codeBefore || undefined,
      isDemo: false,
    };

    if (isVerifiedUser && firebaseUser) {
      try {
        await setDoc(
          doc(db, 'incidents', id),
          stripUndefined({
            ...newInc,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `incidents/${id}`);
      }
    } else {
      setLocalIncidents((prev) => [newInc, ...prev]);
    }

    setSelectedIncidentId(id);
    await appendAuditLog(
      'INCIDENT_SUBMITTED',
      'incident',
      code,
      `Detected ${payload.severity} issue on ${payload.service}: ${payload.title}`
    );
  };

  const handleUpdateAnalysis = async (incidentId: string, analysis: AiAnalysisResult) => {
    const target = incidents.find((i) => i.id === incidentId);
    if (!target) return;

    if (isVerifiedUser && firebaseUser) {
      try {
        const persistedId = await ensureIncidentPersisted(target);
        await updateDoc(doc(db, 'incidents', persistedId), {
          status: target.status === 'Resolved' ? 'Resolved' : 'Patch Ready',
          rootCause: analysis.rootCause.slice(0, 3900),
          recommendedSolution: analysis.recommendedSolution.slice(0, 3900),
          confidence: Math.min(100, Math.max(0, Math.round(analysis.confidence))),
          updatedAt: serverTimestamp(),
        });
        setSelectedIncidentId(persistedId);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `incidents/${incidentId}`);
      }
    } else {
      setLocalIncidents((prev) =>
        prev.map((inc) =>
          inc.id === incidentId
            ? {
                ...inc,
                status: inc.status === 'Resolved' ? 'Resolved' : 'Patch Ready',
                rootCause: analysis.rootCause,
                recommendedSolution: analysis.recommendedSolution,
                confidence: analysis.confidence,
              }
            : inc
        )
      );
    }

    await appendAuditLog(
      'AI_RCA_COMPLETED',
      'incident',
      target.code,
      `Gemini diagnosis completed (${analysis.confidence}% confidence): ${analysis.affectedComponent}`
    );
  };

  const handleSavePatch = async (incidentId: string, codeAfter: string, explanation: string) => {
    const target = incidents.find((i) => i.id === incidentId);
    if (!target) return;

    if (isVerifiedUser && firebaseUser) {
      try {
        const persistedId = await ensureIncidentPersisted(target);
        await updateDoc(doc(db, 'incidents', persistedId), {
          status: 'Awaiting Approval',
          codeAfter: codeAfter.slice(0, 14900),
          recommendedSolution: explanation.slice(0, 3900),
          updatedAt: serverTimestamp(),
        });
        setSelectedIncidentId(persistedId);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `incidents/${incidentId}`);
      }
    } else {
      setLocalIncidents((prev) =>
        prev.map((inc) =>
          inc.id === incidentId
            ? { ...inc, status: 'Awaiting Approval', codeAfter, recommendedSolution: explanation }
            : inc
        )
      );
    }

    await appendAuditLog(
      'AI_PATCH_GENERATED',
      'patch',
      target.code,
      `Synthesized candidate patch for ${target.relatedFile ?? target.service}`
    );
  };

  const handleRecordDeployment = async (params: {
    incident: Incident;
    status: 'Dry Run Verified' | 'Deployed' | 'Rolled Back' | 'Failed';
    testPassedCount: number;
    testTotalCount: number;
    verifiedByBackend: boolean;
    notes: string;
  }) => {
    const depId = `dep_${Date.now()}`;
    const resolvedAt = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';

    if (isVerifiedUser && firebaseUser) {
      try {
        const persistedIncidentId = await ensureIncidentPersisted(params.incident);
        await setDoc(doc(db, 'deployments', depId), {
          id: depId,
          ownerId: firebaseUser.uid,
          incidentId: persistedIncidentId,
          incidentCode: params.incident.code,
          service: params.incident.service,
          patchTitle: params.incident.title.slice(0, 195),
          status: params.status,
          approvedByUid: firebaseUser.uid,
          approvedByName: profile?.displayName ?? firebaseUser.email ?? 'Operator',
          testPassedCount: params.testPassedCount,
          testTotalCount: params.testTotalCount,
          verifiedByBackend: params.verifiedByBackend,
          verificationNotes: params.notes.slice(0, 990),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (params.status === 'Deployed' || params.status === 'Dry Run Verified') {
          await updateDoc(doc(db, 'incidents', persistedIncidentId), {
            status: params.verifiedByBackend ? 'Deployed' : 'Tests Passed',
            resolvedAt,
            resolutionMinutes: 4.2,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `deployments/${depId}`);
      }
    } else {
      setLocalDeployments((prev) => [
        {
          id: depId,
          ownerId: 'demo',
          incidentId: params.incident.id,
          incidentCode: params.incident.code,
          service: params.incident.service,
          patchTitle: params.incident.title,
          status: params.status,
          approvedByUid: 'demo',
          approvedByName: 'Demo Operator',
          testPassedCount: params.testPassedCount,
          testTotalCount: params.testTotalCount,
          verifiedByBackend: params.verifiedByBackend,
          verificationNotes: params.notes,
          timestampLabel: resolvedAt,
        },
        ...prev,
      ]);

      setLocalIncidents((prev) =>
        prev.map((inc) =>
          inc.id === params.incident.id
            ? {
                ...inc,
                status: params.verifiedByBackend ? 'Deployed' : 'Tests Passed',
                resolvedAt,
                resolutionMinutes: 4.2,
              }
            : inc
        )
      );
    }

    await appendAuditLog(
      params.verifiedByBackend ? 'PATCH_DEPLOYED_VERIFIED' : 'PATCH_DRY_RUN_VERIFIED',
      'deployment',
      params.incident.code,
      params.notes
    );
  };

  const handleRollbackIncident = async (incidentId: string) => {
    const target = incidents.find((i) => i.id === incidentId);
    if (!target) return;

    if (isVerifiedUser && firebaseUser) {
      try {
        const persistedId = await ensureIncidentPersisted(target);
        await updateDoc(doc(db, 'incidents', persistedId), {
          status: 'Rolled Back',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `incidents/${incidentId}`);
      }
    } else {
      setLocalIncidents((prev) =>
        prev.map((inc) => (inc.id === incidentId ? { ...inc, status: 'Rolled Back' } : inc))
      );
    }

    await appendAuditLog(
      'DEPLOYMENT_ROLLED_BACK',
      'incident',
      target.code,
      `Operator triggered rollback for ${target.service}`
    );
  };

  const handleSaveIntegration = async (updated: IntegrationItem) => {
    if (isVerifiedUser && firebaseUser) {
      const docId = `${updated.id}_${firebaseUser.uid.slice(0, 8)}`;
      try {
        await setDoc(
          doc(db, 'integrations', docId),
          stripUndefined({
            id: docId,
            ownerId: firebaseUser.uid,
            provider: updated.provider,
            category: updated.category,
            status: updated.status,
            accountLabel: updated.accountLabel,
            endpointUrl: updated.endpointUrl,
            credentialFingerprint: updated.credentialFingerprint,
            lastSyncAt: updated.lastSyncAt,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `integrations/${docId}`);
      }
    } else {
      setLocalIntegrations((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    }

    await appendAuditLog(
      'INTEGRATION_CONNECTED',
      'integration',
      updated.provider,
      `Connected ${updated.provider} (${updated.accountLabel}) with encrypted credential envelope`
    );
  };

  const handleDisconnectIntegration = async (item: IntegrationItem) => {
    if (isVerifiedUser && firebaseUser) {
      const docId = `${item.id}_${firebaseUser.uid.slice(0, 8)}`;
      try {
        await updateDoc(doc(db, 'integrations', docId), {
          status: 'Disconnected',
          accountLabel: 'Not connected',
          endpointUrl: '',
          credentialFingerprint: '',
          lastSyncAt: 'Disconnected',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `integrations/${docId}`);
      }
    } else {
      setLocalIntegrations((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: 'Demo Data',
                accountLabel: 'Sample dataset',
                endpointUrl: undefined,
                credentialFingerprint: undefined,
                lastSyncAt: 'Sample dataset',
              }
            : it
        )
      );
    }

    await appendAuditLog(
      'INTEGRATION_DISCONNECTED',
      'integration',
      item.provider,
      `Disconnected ${item.provider} connector`
    );
  };

  const handleUpdateProfile = async (updates: {
    displayName: string;
    jobTitle: string;
    notificationsEnabled: boolean;
    autoApproveLowRisk: boolean;
  }) => {
    if (!isVerifiedUser || !firebaseUser) return;
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        displayName: updates.displayName,
        jobTitle: updates.jobTitle,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', firebaseUser.uid, 'private', 'account'), {
        email: firebaseUser.email ?? privateAccount?.email ?? '',
        notificationsEnabled: updates.notificationsEnabled,
        autoApproveLowRisk: updates.autoApproveLowRisk,
        updatedAt: serverTimestamp(),
      });
      setProfile((prev) =>
        prev ? { ...prev, displayName: updates.displayName, jobTitle: updates.jobTitle } : prev
      );
      setPrivateAccount((prev) =>
        prev
          ? {
              ...prev,
              notificationsEnabled: updates.notificationsEnabled,
              autoApproveLowRisk: updates.autoApproveLowRisk,
            }
          : prev
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setMobileMenuOpen(false);
    setVerificationSentNotice(false);
  };

  const connectedIntegrationCount = integrations.filter((i) => i.status === 'Connected').length;

  if (section === 'home') {
    return (
      <>
        <LandingPage
          isAuthenticated={Boolean(firebaseUser)}
          onExploreDashboard={() => navigateTo('dashboard')}
          onGetStarted={() => {
            if (firebaseUser) {
              navigateTo('dashboard');
            } else {
              setAuthModalMode('signup');
              setAuthModalOpen(true);
            }
          }}
          onNavigateSection={(sec) => navigateTo(sec)}
        />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode={authModalMode}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between bg-[#070B18] border-r border-slate-800/80 p-4">
        <div className="space-y-6">
          <div className="px-2 pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="inline-flex items-center gap-2.5 text-lg font-display font-bold tracking-tight text-white cursor-pointer"
            >
              <BrandLogo size={26} />
              <span>The Autoops</span>
            </button>
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-900/60 transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Landing Page</span>
          </button>

          {firebaseUser ? (
            <div className="p-3 rounded-lg bg-[#0A1022] border border-slate-800 space-y-2 text-xs">
              <div className="font-medium text-white truncate">
                {profile?.displayName ?? firebaseUser.displayName ?? firebaseUser.email}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono uppercase text-blue-300">
                  {profile?.role ?? 'operator'}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/90 hover:bg-rose-950/60 border border-slate-700/80 hover:border-rose-700/70 text-slate-200 hover:text-rose-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                  Log Out
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthModalMode('login');
                setAuthModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In / Sign Up
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden bg-black/70 backdrop-blur-sm flex">
          <div className="w-64 bg-[#070B18] border-r border-slate-800 p-4 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-lg font-display font-bold text-white">
                  <BrandLogo size={24} />
                  <span>The Autoops</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        navigateTo(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium ${
                        active ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  navigateTo('home');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Landing Page
              </button>
              {firebaseUser ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/70 text-rose-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthModalMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In / Sign Up
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Workspace Top Bar */}
        <header className="h-14 border-b border-slate-800/80 bg-[#050814]/90 backdrop-blur-sm px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back to previous page"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0A1022] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              Back
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-400 truncate">
              <BrandLogo size={18} className="hidden sm:block" />
              <span className="font-medium text-slate-200">The Autoops</span>
              <span aria-hidden="true">/</span>
              <span className="truncate">
                {NAV_ITEMS.find((n) => n.id === section)?.label ?? 'Console'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('incidents')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A1022] hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              {incidents.filter((i) => i.status !== 'Resolved' && i.status !== 'Rolled Back').length}{' '}
              Active
            </button>

            {!firebaseUser ? (
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('login');
                  setAuthModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigateTo('settings')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0A1022] border border-slate-800 text-xs text-slate-200 hover:border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="max-w-[140px] truncate">
                    {profile?.displayName ?? firebaseUser.email}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A1022] hover:bg-rose-950/60 border border-slate-800 hover:border-rose-700/70 text-xs font-medium text-slate-200 hover:text-rose-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Unverified Email Prompt Banner */}
        {firebaseUser && !firebaseUser.emailVerified && (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/70 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
            <span>
              Your email ({firebaseUser.email}) is not yet verified. Verify your inbox to enable
              cloud persistence in Firestore, or use Google Sign-In for instant verified access.
            </span>
            <button
              type="button"
              onClick={async () => {
                await sendEmailVerification(firebaseUser);
                setVerificationSentNotice(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              {verificationSentNotice ? 'Verification Email Sent' : 'Resend Verification'}
            </button>
          </div>
        )}

        {/* Active Section Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {section === 'dashboard' && (
                <DashboardView
                  incidents={incidents}
                  auditLogs={auditLogs}
                  liveTelemetry={liveTelemetry}
                  connectedIntegrationCount={connectedIntegrationCount}
                  onSelectIncident={(inc, target) => {
                    setSelectedIncidentId(inc.id);
                    navigateTo(target);
                  }}
                  onNavigate={navigateTo}
                />
              )}

              {section === 'incidents' && (
                <IncidentsView
                  incidents={incidents}
                  onSelectIncident={(inc, target) => {
                    setSelectedIncidentId(inc.id);
                    navigateTo(target);
                  }}
                  onCreateIncident={handleCreateIncident}
                />
              )}

              {section === 'analysis' && (
                <RootCauseView
                  incidents={incidents}
                  selectedIncident={selectedIncident}
                  onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
                  onUpdateAnalysis={handleUpdateAnalysis}
                  onProceedToFix={(inc) => {
                    setSelectedIncidentId(inc.id);
                    navigateTo('fixes');
                  }}
                  onNavigate={navigateTo}
                />
              )}

              {section === 'fixes' && (
                <AutomatedFixesView
                  incidents={incidents}
                  selectedIncident={selectedIncident}
                  onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
                  integrations={integrations}
                  userRole={profile?.role ?? 'operator'}
                  userDisplayName={
                    profile?.displayName ?? firebaseUser?.email ?? 'Authorized Operator'
                  }
                  onSavePatch={handleSavePatch}
                  onRecordDeployment={handleRecordDeployment}
                  onRollbackIncident={handleRollbackIncident}
                />
              )}

              {section === 'history' && (
                <HistoryView
                  incidents={incidents}
                  deployments={deployments}
                  onInspectIncident={(inc) => {
                    setSelectedIncidentId(inc.id);
                    navigateTo('analysis');
                  }}
                />
              )}

              {section === 'integrations' && (
                <IntegrationsView
                  integrations={integrations}
                  isSignedIn={isVerifiedUser}
                  onSaveIntegration={handleSaveIntegration}
                  onDisconnectIntegration={handleDisconnectIntegration}
                  onRequireAuth={() => {
                    setAuthModalMode('login');
                    setAuthModalOpen(true);
                  }}
                />
              )}

              {section === 'settings' && (
                <SettingsSecurityView
                  profile={profile}
                  privateAccount={privateAccount}
                  isAuthenticated={isVerifiedUser}
                  hasSession={Boolean(firebaseUser)}
                  auditLogs={auditLogs}
                  deployments={deployments}
                  onUpdateProfile={handleUpdateProfile}
                  onSignOut={handleSignOut}
                  onRequireAuth={() => {
                    setAuthModalMode('login');
                    setAuthModalOpen(true);
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
