export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';

export type IncidentStatus =
  | 'Detected'
  | 'Analyzing'
  | 'Patch Ready'
  | 'Awaiting Approval'
  | 'Tests Passed'
  | 'Deployed'
  | 'Resolved'
  | 'Rolled Back';

export type UserRole = 'admin' | 'operator' | 'viewer';

export type AppSection =
  | 'home'
  | 'dashboard'
  | 'incidents'
  | 'analysis'
  | 'fixes'
  | 'history'
  | 'integrations'
  | 'settings';

export interface UserProfile {
  uid: string;
  displayName: string;
  role: UserRole;
  jobTitle?: string;
}

export interface UserPrivateAccount {
  uid: string;
  email: string;
  notificationsEnabled: boolean;
  autoApproveLowRisk: boolean;
}

export interface Incident {
  id: string;
  ownerId: string;
  code: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  service: string;
  environment: 'production' | 'staging' | 'canary';
  detectedAt: string;
  resolvedAt?: string;
  description: string;
  logs?: string;
  relatedFile?: string;
  codeBefore?: string;
  codeAfter?: string;
  rootCause?: string;
  recommendedSolution?: string;
  confidence?: number;
  resolutionMinutes?: number;
  isDemo: boolean;
}

export interface AiAnalysisResult {
  rootCause: string;
  affectedComponent: string;
  possibleReasons: string[];
  recommendedSolution: string;
  confidence: number;
  similarIncidentMatch?: string;
  reasoningSteps: string[];
  modelUsed?: string;
  analyzedAt?: string;
}

export interface AiPatchResult {
  codeAfter: string;
  patchExplanation: string;
  riskLevel: string;
  testCases: Array<{ name: string; assertion: string }>;
  modelUsed?: string;
  generatedAt?: string;
}

export interface TestCheckItem {
  name: string;
  status: 'passed' | 'failed';
  durationMs: number;
  detail: string;
}

export interface TestRunResult {
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  executionMode: string;
  checks: TestCheckItem[];
  executedAt: string;
}

export interface IncidentReportData {
  executiveSummary: string;
  impactAssessment: string;
  rootCauseSummary: string;
  remediationAction: string;
  preventiveMeasures: string[];
  generatedAt?: string;
}

export interface IntegrationItem {
  id: string;
  ownerId: string;
  provider: string;
  category: string;
  description: string;
  status: 'Connected' | 'Demo Data' | 'Disconnected' | 'Error';
  accountLabel: string;
  endpointUrl?: string;
  credentialFingerprint?: string;
  lastSyncAt?: string;
  supportsDeployTarget?: boolean;
}

export interface DeploymentRecord {
  id: string;
  ownerId: string;
  incidentId: string;
  incidentCode: string;
  service: string;
  patchTitle: string;
  status: 'Dry Run Verified' | 'Deployed' | 'Rolled Back' | 'Failed';
  approvedByUid: string;
  approvedByName?: string;
  testPassedCount?: number;
  testTotalCount?: number;
  verifiedByBackend: boolean;
  verificationNotes?: string;
  timestampLabel?: string;
}

export interface AuditLogEntry {
  id: string;
  ownerId: string;
  actorUid: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestampLabel?: string;
}

export interface TelemetryPoint {
  time: string;
  cpu: number;
  memory: number;
  latencyMs: number;
  errorRate: number;
}

export interface LiveBackendTelemetry {
  source: string;
  timestamp: string;
  cpuPct: number;
  usedMemPct: number;
  heapUsedMb: number;
  eventLoopLagMs: number;
  uptimeSec: number;
  nodeVersion: string;
}
