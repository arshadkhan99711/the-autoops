/**
 * AutoOps AI Security Rules Verification Suite (Phase 0 TDD)
 * Evaluates the "Dirty Dozen" adversarial payloads against the Eight Pillars.
 */

export interface DirtyDozenCheck {
  id: number;
  name: string;
  collection: string;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const dirtyDozenCases: DirtyDozenCheck[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on User Registration',
    collection: '/users/{userId}',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidUserProfile -> data.keys().hasOnly([...])',
  },
  {
    id: 2,
    name: 'Self-Assigned Admin Escalation',
    collection: '/users/{userId}',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: "incoming().role in ['operator', 'viewer'] || isBootstrapAdmin()",
  },
  {
    id: 3,
    name: 'Unverified Email Write',
    collection: '/incidents/{incidentId}',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isSignedIn() -> request.auth.token.email_verified == true',
  },
  {
    id: 4,
    name: 'ID Poisoning (>128 chars or invalid chars)',
    collection: '/incidents/{incidentId}',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: "isValidId(incidentId) -> id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$')",
  },
  {
    id: 5,
    name: 'Owner Spoofing on Create',
    collection: '/incidents/{incidentId}',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().ownerId == request.auth.uid',
  },
  {
    id: 6,
    name: 'Timestamp Forgery',
    collection: '/incidents/{incidentId}',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().createdAt == request.time',
  },
  {
    id: 7,
    name: 'PII Blanket Read on Private Account',
    collection: '/users/{userId}/private/account',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'allow get: isOwner(userId) || isAdmin(); allow list: if false;',
  },
  {
    id: 8,
    name: 'Unscoped List Query Scraping',
    collection: '/incidents',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'allow list: resource.data.ownerId == request.auth.uid',
  },
  {
    id: 9,
    name: 'Terminal State Bypass (Modifying Resolved Incident)',
    collection: '/incidents/{incidentId}',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: "existing().status != 'Resolved'",
  },
  {
    id: 10,
    name: 'Immutable Owner Tampering',
    collection: '/incidents/{incidentId}',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().ownerId == existing().ownerId',
  },
  {
    id: 11,
    name: 'Audit Log Tampering (Update/Delete)',
    collection: '/auditLogs/{logId}',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'allow update: if false; allow delete: if false;',
  },
  {
    id: 12,
    name: 'Resource Exhaustion Oversized String',
    collection: '/incidents/{incidentId}',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'data.title.size() <= 200 && data.description.size() <= 2000',
  },
];
