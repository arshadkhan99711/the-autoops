import type {
  AuditLogEntry,
  DeploymentRecord,
  Incident,
  IntegrationItem,
  TelemetryPoint,
} from '../types/ops';

export const DEMO_INCIDENTS: Incident[] = [
  {
    id: 'inc_4821',
    ownerId: 'demo',
    code: 'INC-4821',
    title: 'Checkout API Connection Pool Exhaustion Under Burst Load',
    severity: 'Critical',
    status: 'Awaiting Approval',
    service: 'checkout-gateway',
    environment: 'production',
    detectedAt: '2026-11-24 02:51:14 UTC',
    description:
      'PostgreSQL client pool reached max=20 connections; incoming /v2/orders requests timing out after 5000ms with 503 Service Unavailable spikes.',
    relatedFile: 'src/services/checkoutPool.ts',
    logs: `[2026-11-24T02:51:12.104Z] ERROR checkout-gateway/pool: Timeout acquiring client from pgPool (waiting: 48, active: 20/20)
[2026-11-24T02:51:12.882Z] WARN  checkout-gateway/http: POST /v2/orders 503 latency=5004ms trace_id=9f81a2c4
[2026-11-24T02:51:13.410Z] ERROR checkout-gateway/tx: Unhandled rejection in reserveInventory() - connection not released on throw
[2026-11-24T02:51:14.002Z] ALERT autoops-watcher: Error rate crossed 4.8% threshold (baseline 0.12%)`,
    codeBefore: `export async function reserveInventory(orderId: string, sku: string, qty: number) {
  const client = await pgPool.connect();
  await client.query('BEGIN');
  const stock = await client.query(
    'SELECT available FROM inventory WHERE sku = $1 FOR UPDATE',
    [sku]
  );
  if ((stock.rows[0]?.available ?? 0) < qty) {
    throw new Error('Insufficient inventory');
  }
  await client.query(
    'UPDATE inventory SET available = available - $1 WHERE sku = $2',
    [qty, sku]
  );
  await client.query('COMMIT');
  client.release();
  return { orderId, reserved: true };
}`,
    codeAfter: `export async function reserveInventory(orderId: string, sku: string, qty: number) {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const stock = await client.query(
      'SELECT available FROM inventory WHERE sku = $1 FOR UPDATE',
      [sku]
    );
    if ((stock.rows[0]?.available ?? 0) < qty) {
      await client.query('ROLLBACK');
      throw new Error('Insufficient inventory');
    }
    await client.query(
      'UPDATE inventory SET available = available - $1 WHERE sku = $2',
      [qty, sku]
    );
    await client.query('COMMIT');
    return { orderId, reserved: true };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}`,
    rootCause:
      'In reserveInventory(), pgPool.connect() acquires a dedicated PostgreSQL connection outside a try/finally block. When inventory validation throws "Insufficient inventory", client.release() is skipped, leaking connections until the pool (max 20) saturates.',
    recommendedSolution:
      'Wrap the transaction lifecycle in try/catch/finally so ROLLBACK executes on failure and client.release() is guaranteed on every exit path.',
    confidence: 97,
    isDemo: true,
  },
  {
    id: 'inc_4820',
    ownerId: 'demo',
    code: 'INC-4820',
    title: 'Auth Token Verification Cache Stampede on JWKS Rotation',
    severity: 'High',
    status: 'Analyzing',
    service: 'auth-edge-proxy',
    environment: 'production',
    detectedAt: '2026-11-24 02:38:09 UTC',
    description:
      'Upstream OIDC JWKS endpoint hit with 1,400 concurrent uncached fetches after key TTL expiry, elevating P95 latency to 840ms.',
    relatedFile: 'src/middleware/jwksVerifier.ts',
    logs: `[2026-11-24T02:38:07.119Z] WARN  auth-edge-proxy: JWKS cache expired; dispatching fetch to /well-known/jwks.json
[2026-11-24T02:38:07.410Z] WARN  auth-edge-proxy: 1,412 concurrent cache misses triggering upstream rate-limit 429
[2026-11-24T02:38:08.992Z] ERROR auth-edge-proxy: Token verification failed: FetchError 429 Too Many Requests`,
    codeBefore: `let cachedKeys: Record<string, string> | null = null;
let expiresAt = 0;

export async function getSigningKey(kid: string): Promise<string> {
  if (!cachedKeys || Date.now() > expiresAt) {
    const res = await fetch('https://idp.example.com/.well-known/jwks.json');
    const data = await res.json();
    cachedKeys = data.keys;
    expiresAt = Date.now() + 300_000;
  }
  return cachedKeys?.[kid] ?? '';
}`,
    rootCause:
      'Missing single-flight promise coalescing allows thousands of concurrent requests to issue parallel JWKS HTTP fetches when expiresAt lapses.',
    recommendedSolution:
      'Deduplicate concurrent refreshes via an in-flight promise reference and retain stale keys briefly while refreshing in background.',
    confidence: 94,
    isDemo: true,
  },
  {
    id: 'inc_4819',
    ownerId: 'demo',
    code: 'INC-4819',
    title: 'Billing Webhook Worker Memory Growth on Unbounded Retry Queue',
    severity: 'Medium',
    status: 'Patch Ready',
    service: 'billing-worker',
    environment: 'staging',
    detectedAt: '2026-11-24 01:44:32 UTC',
    description:
      'Container RSS memory climbed from 320MB to 1.78GB over 40 minutes due to in-memory retry payload retention.',
    relatedFile: 'src/workers/webhookDispatcher.ts',
    logs: `[2026-11-24T01:44:28.004Z] WARN  billing-worker: Heap usage at 86% of 2048MB container limit
[2026-11-24T01:44:31.519Z] INFO  billing-worker: retryBuffer.length=42,890 unresolved webhook events`,
    codeBefore: `const retryBuffer: Array<{ url: string; payload: unknown }> = [];

export function scheduleRetry(url: string, payload: unknown) {
  retryBuffer.push({ url, payload });
}`,
    codeAfter: `const MAX_RETRY_BUFFER = 500;
const retryBuffer: Array<{ url: string; payload: unknown }> = [];

export function scheduleRetry(url: string, payload: unknown) {
  if (retryBuffer.length >= MAX_RETRY_BUFFER) {
    retryBuffer.shift();
  }
  retryBuffer.push({ url, payload });
}`,
    rootCause:
      'Unbounded in-memory array retryBuffer accumulates full webhook payloads without eviction or dead-letter cap when downstream receivers stall.',
    recommendedSolution:
      'Enforce a bounded ring-buffer cap with dead-letter spillover logging to prevent OOM termination.',
    confidence: 91,
    isDemo: true,
  },
  {
    id: 'inc_4818',
    ownerId: 'demo',
    code: 'INC-4818',
    title: 'Search Indexer Slow Query on Unindexed Tenant Partition',
    severity: 'Low',
    status: 'Detected',
    service: 'search-indexer',
    environment: 'canary',
    detectedAt: '2026-11-24 00:19:45 UTC',
    description:
      'Full collection scan observed on tenant_events during nightly reindex batch.',
    relatedFile: 'src/jobs/reindexTenant.ts',
    logs: `[2026-11-24T00:19:45.211Z] WARN search-indexer: Query duration 2410ms exceeds 500ms budget`,
    codeBefore: `export async function fetchTenantBatch(db: any, tenantId: string) {
  return db.query('SELECT * FROM tenant_events WHERE tenant_id = $1 ORDER BY created_at DESC', [tenantId]);
}`,
    isDemo: true,
  },
  {
    id: 'inc_4816',
    ownerId: 'demo',
    code: 'INC-4816',
    title: 'Redis Session Deserialization Crash on Null Payload',
    severity: 'High',
    status: 'Resolved',
    service: 'session-store',
    environment: 'production',
    detectedAt: '2026-11-23 19:12:04 UTC',
    resolvedAt: '2026-11-23 19:18:40 UTC',
    description:
      'Expired Redis session keys returned null string causing JSON.parse TypeError in Express middleware.',
    relatedFile: 'src/middleware/sessionHydrator.ts',
    logs: `[2026-11-23T19:12:04.100Z] ERROR session-store: SyntaxError: Unexpected end of JSON input at JSON.parse`,
    codeBefore: `export function parseSession(raw: string) {
  return JSON.parse(raw);
}`,
    codeAfter: `export function parseSession(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}`,
    rootCause: 'Missing null and malformed-JSON guard before JSON.parse(raw) on evicted Redis keys.',
    recommendedSolution: 'Return null safely when Redis returns empty/corrupt payload.',
    confidence: 99,
    resolutionMinutes: 6.6,
    isDemo: true,
  },
  {
    id: 'inc_4812',
    ownerId: 'demo',
    code: 'INC-4812',
    title: 'Kubernetes Readiness Probe Timeout During Cold Image Pull',
    severity: 'Medium',
    status: 'Resolved',
    service: 'recommendation-engine',
    environment: 'production',
    detectedAt: '2026-11-22 14:05:11 UTC',
    resolvedAt: '2026-11-22 14:16:29 UTC',
    description:
      'Pods restarted repeatedly because initialDelaySeconds=5 was shorter than ML embedding warmup (14s).',
    relatedFile: 'k8s/recommendation-deploy.yaml',
    rootCause: 'Readiness probe initialDelaySeconds set to 5s while cold-start model load takes 14s.',
    recommendedSolution: 'Move warmup check to startupProbe with failureThreshold=12 and periodSeconds=3.',
    confidence: 96,
    resolutionMinutes: 11.3,
    isDemo: true,
  },
];

export const TELEMETRY_SERIES: Record<'15m' | '1h' | '6h' | '24h', TelemetryPoint[]> = {
  '15m': [
    { time: '02:50', cpu: 41, memory: 62, latencyMs: 118, errorRate: 0.14 },
    { time: '02:52', cpu: 44, memory: 63, latencyMs: 126, errorRate: 0.18 },
    { time: '02:54', cpu: 58, memory: 67, latencyMs: 194, errorRate: 0.62 },
    { time: '02:56', cpu: 79, memory: 74, latencyMs: 412, errorRate: 3.45 },
    { time: '02:58', cpu: 86, memory: 78, latencyMs: 486, errorRate: 4.82 },
    { time: '03:00', cpu: 74, memory: 76, latencyMs: 310, errorRate: 2.15 },
    { time: '03:02', cpu: 56, memory: 70, latencyMs: 165, errorRate: 0.44 },
    { time: '03:05', cpu: 46, memory: 66, latencyMs: 132, errorRate: 0.19 },
  ],
  '1h': [
    { time: '02:10', cpu: 36, memory: 58, latencyMs: 108, errorRate: 0.11 },
    { time: '02:20', cpu: 39, memory: 59, latencyMs: 112, errorRate: 0.12 },
    { time: '02:30', cpu: 52, memory: 64, latencyMs: 245, errorRate: 1.18 },
    { time: '02:40', cpu: 48, memory: 63, latencyMs: 158, errorRate: 0.35 },
    { time: '02:50', cpu: 64, memory: 69, latencyMs: 280, errorRate: 1.84 },
    { time: '03:00', cpu: 78, memory: 76, latencyMs: 440, errorRate: 3.92 },
    { time: '03:05', cpu: 49, memory: 67, latencyMs: 138, errorRate: 0.21 },
  ],
  '6h': [
    { time: '21:00', cpu: 31, memory: 54, latencyMs: 95, errorRate: 0.08 },
    { time: '22:00', cpu: 34, memory: 55, latencyMs: 102, errorRate: 0.09 },
    { time: '23:00', cpu: 42, memory: 59, latencyMs: 121, errorRate: 0.15 },
    { time: '00:00', cpu: 46, memory: 61, latencyMs: 144, errorRate: 0.28 },
    { time: '01:00', cpu: 55, memory: 68, latencyMs: 190, errorRate: 0.72 },
    { time: '02:00', cpu: 63, memory: 71, latencyMs: 265, errorRate: 1.45 },
    { time: '03:00', cpu: 49, memory: 67, latencyMs: 138, errorRate: 0.21 },
  ],
  '24h': [
    { time: '04:00', cpu: 28, memory: 51, latencyMs: 88, errorRate: 0.06 },
    { time: '08:00', cpu: 45, memory: 58, latencyMs: 129, errorRate: 0.17 },
    { time: '12:00', cpu: 61, memory: 64, latencyMs: 178, errorRate: 0.38 },
    { time: '16:00', cpu: 58, memory: 65, latencyMs: 164, errorRate: 0.29 },
    { time: '20:00', cpu: 52, memory: 62, latencyMs: 152, errorRate: 0.22 },
    { time: '00:00', cpu: 44, memory: 60, latencyMs: 134, errorRate: 0.19 },
    { time: '03:00', cpu: 49, memory: 67, latencyMs: 138, errorRate: 0.21 },
  ],
};

export const SERVER_NODES = [
  { name: 'prod-us-east-01', role: 'checkout-gateway', cpu: '68%', memory: '74%', latency: '142ms', status: 'Degraded' },
  { name: 'prod-us-east-02', role: 'auth-edge-proxy', cpu: '52%', memory: '61%', latency: '84ms', status: 'Healthy' },
  { name: 'prod-eu-west-01', role: 'session-store', cpu: '31%', memory: '49%', latency: '28ms', status: 'Healthy' },
  { name: 'stg-us-west-01', role: 'billing-worker', cpu: '44%', memory: '86%', latency: '195ms', status: 'Warning' },
];

export const DEFAULT_INTEGRATIONS: IntegrationItem[] = [
  {
    id: 'int_github',
    ownerId: 'demo',
    provider: 'GitHub',
    category: 'Source & PRs',
    description: 'Read repository source context and open verified remediation pull requests.',
    status: 'Demo Data',
    accountLabel: 'Sample Org (autoops-demo)',
    supportsDeployTarget: true,
    lastSyncAt: 'Sample dataset',
  },
  {
    id: 'int_gitlab',
    ownerId: 'demo',
    provider: 'GitLab',
    category: 'Source & CI',
    description: 'Connect merge request pipelines and trigger CI test verification.',
    status: 'Demo Data',
    accountLabel: 'Sample Group',
    supportsDeployTarget: true,
    lastSyncAt: 'Sample dataset',
  },
  {
    id: 'int_docker',
    ownerId: 'demo',
    provider: 'Docker',
    category: 'Containers',
    description: 'Inspect container layer diffs, image digests, and runtime crash dumps.',
    status: 'Demo Data',
    accountLabel: 'Registry Sample',
    supportsDeployTarget: false,
    lastSyncAt: 'Sample dataset',
  },
  {
    id: 'int_kubernetes',
    ownerId: 'demo',
    provider: 'Kubernetes',
    category: 'Orchestration',
    description: 'Monitor pod restarts, OOMKills, readiness probes, and canary rollouts.',
    status: 'Demo Data',
    accountLabel: 'eks-prod-cluster (sample)',
    supportsDeployTarget: true,
    lastSyncAt: 'Sample dataset',
  },
  {
    id: 'int_aws',
    ownerId: 'demo',
    provider: 'AWS',
    category: 'Cloud Infra',
    description: 'Stream CloudWatch logs, Lambda traces, and ECS/EC2 health telemetry.',
    status: 'Demo Data',
    accountLabel: 'us-east-1 (sample)',
    supportsDeployTarget: true,
    lastSyncAt: 'Sample dataset',
  },
  {
    id: 'int_gcp',
    ownerId: 'demo',
    provider: 'Google Cloud',
    category: 'Cloud Infra',
    description: 'Ingest Cloud Run logs, GKE events, and Cloud Monitoring alerts.',
    status: 'Demo Data',
    accountLabel: 'gcp-ops-sample',
    supportsDeployTarget: true,
    lastSyncAt: 'Sample dataset',
  },
  {
    id: 'int_azure',
    ownerId: 'demo',
    provider: 'Microsoft Azure',
    category: 'Cloud Infra',
    description: 'Connect Azure Monitor alerts and AKS workload diagnostics.',
    status: 'Demo Data',
    accountLabel: 'azure-sub-sample',
    supportsDeployTarget: true,
    lastSyncAt: 'Sample dataset',
  },
  {
    id: 'int_slack',
    ownerId: 'demo',
    provider: 'Slack',
    category: 'Incident Ops',
    description: 'Send incident alerts and human approval prompts to engineering channels.',
    status: 'Demo Data',
    accountLabel: '#sre-alerts (sample)',
    supportsDeployTarget: false,
    lastSyncAt: 'Sample dataset',
  },
  {
    id: 'int_datadog',
    ownerId: 'demo',
    provider: 'Datadog',
    category: 'Observability',
    description: 'Correlate APM flamegraphs, error tracking, and SLO burn rates.',
    status: 'Demo Data',
    accountLabel: 'APM Prod (sample)',
    supportsDeployTarget: false,
    lastSyncAt: 'Sample dataset',
  },
  {
    id: 'int_prometheus',
    ownerId: 'demo',
    provider: 'Prometheus',
    category: 'Metrics',
    description: 'Query PromQL time-series metrics and Alertmanager webhook events.',
    status: 'Demo Data',
    accountLabel: 'prom-main (sample)',
    supportsDeployTarget: false,
    lastSyncAt: 'Sample dataset',
  },
];

export const DEMO_DEPLOYMENTS: DeploymentRecord[] = [
  {
    id: 'dep_901',
    ownerId: 'demo',
    incidentId: 'inc_4816',
    incidentCode: 'INC-4816',
    service: 'session-store',
    patchTitle: 'Add null & try/catch guard in parseSession()',
    status: 'Dry Run Verified',
    approvedByUid: 'demo',
    approvedByName: 'Elena Vance (Sample)',
    testPassedCount: 6,
    testTotalCount: 6,
    verifiedByBackend: false,
    verificationNotes: 'Sample historical record (sandbox verified)',
    timestampLabel: '2026-11-23 19:18 UTC',
  },
];

export const DEMO_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'aud_01',
    ownerId: 'demo',
    actorUid: 'demo',
    actorRole: 'operator',
    action: 'AI_ROOT_CAUSE_COMPLETED',
    targetType: 'incident',
    targetId: 'INC-4821',
    details: 'Isolated unclosed pgPool client leak inside reserveInventory() catch path.',
    timestampLabel: '02:51:42 UTC',
  },
  {
    id: 'aud_02',
    ownerId: 'demo',
    actorUid: 'demo',
    actorRole: 'admin',
    action: 'HUMAN_APPROVAL_REQUESTED',
    targetType: 'patch',
    targetId: 'INC-4821',
    details: 'Patch queued for authorized operator review before production deployment.',
    timestampLabel: '02:52:09 UTC',
  },
];
