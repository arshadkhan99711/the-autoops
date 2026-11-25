# AutoOps AI Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Workspace Isolation**: Every incident, integration, deployment record, and audit log belongs to a verified `ownerId` matching `request.auth.uid` (or accessed by a verified admin).
2. **PII Isolation**: User email addresses and private preferences reside strictly in `/users/{userId}/private/account`, readable and writable only by the authenticated owner or verified admin.
3. **Privilege Escalation Prevention**: Users cannot assign themselves the `admin` role on registration or profile update unless verified as the system bootstrap administrator (`arshadkhan99711@gmail.com` with `email_verified == true`) or promoted by an existing admin via `/admins/{userId}`.
4. **Temporal & Identity Integrity**: All `createdAt` and `updatedAt` timestamps must match `request.time`. Immutable fields (`id`, `ownerId`, `uid`, `createdAt`) cannot change after document creation.
5. **Audit Trail Immutability**: Documents in `/auditLogs/{logId}` are append-only; updates and deletes are unconditionally denied.
6. **Secret Exclusion**: Integration credentials are never stored in plaintext inside Firestore. Only masked credential fingerprints and server-verified metadata are stored.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on User Registration**: `{ uid, displayName, role: "operator", isAdmin: true, createdAt, updatedAt }` -> Denied (`hasOnly` rejects `isAdmin`).
2. **Self-Assigned Admin Escalation**: `{ uid, displayName, role: "admin", createdAt, updatedAt }` by non-admin user -> Denied.
3. **Unverified Email Write**: Creating an incident with `email_verified == false` -> Denied.
4. **ID Poisoning**: Creating `/incidents/` with a 500-character ID or slashes/dots -> Denied by `isValidId()`.
5. **Owner Spoofing**: Creating `/incidents/` with `ownerId: "victim-uid"` -> Denied (`ownerId == request.auth.uid`).
6. **Timestamp Forgery**: Creating `/incidents/` with client-supplied past `createdAt` -> Denied (`createdAt == request.time`).
7. **PII Blanket Read**: Non-owner authenticated user attempting `get` or `list` on `/users/{victimId}/private/account` -> Denied.
8. **Query Scraping (`list` without owner filter)**: Authenticated user running `collection('incidents')` without `where('ownerId', '==', uid)` -> Denied by `allow list` resource check.
9. **Terminal State Bypass**: Updating an incident whose status is `Resolved` without admin override or rollback transition -> Denied.
10. **Immutable Owner Tampering**: Updating an existing incident to reassign `ownerId` -> Denied.
11. **Audit Log Tampering**: Updating or deleting an entry in `/auditLogs/{logId}` -> Denied (`allow update, delete: if false`).
12. **Resource Exhaustion String**: Submitting a 25KB string in `title` or `description` -> Denied by strict `.size()` checks.
