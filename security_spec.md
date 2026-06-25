# CivicLens Firestore Security Specification

This document details the security model, physical boundaries, and preventative rules configured for Firestore on CivicLens to defend against injection, malicious state shortcuts, and unauthenticated writes.

## 1. Data Invariants

- **Ownership and Attribution**: No user can submit or update an issue report attributing it to a `userId` other than their own authenticated UID (`request.auth.uid`).
- **Profile Integrity**: A user can only register or view their own private profile `/users/{userId}`.
- **State Integrity**: New issue reports must start with a status of `Submitted` and zero upvotes.
- **Terminal State Lock**: Once status is marked as `Resolved`, it is considered locked from further modifications by non-admins.
- **Size Boundaries**: Proof images (`image`), descriptions, and IDs must have strictly enforced length limits to prevent Denial of Wallet memory exhaustion.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following attack payloads are designed to breach identity, state, or bounds, and MUST return `PERMISSION_DENIED` under all configurations.

### Attack 1: User Profile Forgery (Identity Spoofing)
An attacker attempts to write a user profile document in `/users/victim_uid` using their own authenticated session.
```json
{
  "userId": "victim_uid",
  "displayName": "Hacker",
  "email": "hacker@evil.com",
  "createdAt": "2026-06-22T08:00:00Z"
}
```

### Attack 2: Spoofing Reporter ID (Identity Spoofing)
Attacking user `hacker_uid` attempts to create an issue report claiming an honest user `honest_uid` reported it.
```json
{
  "id": "bad_report_101",
  "ticketId": "CIVIC-123456",
  "image": "data:image/png;base64,...",
  "category": "Pothole & Roads",
  "description": "Fake issue",
  "locationName": "New Delhi",
  "status": "Submitted",
  "citizenUpvotes": 0,
  "userId": "honest_uid",
  "timestamp": "2026-06-22T08:00:00Z"
}
```

### Attack 3: Pre-Assigned Verified (State Shortcut)
A malicious user reports an issue, setting the status directly to `Resolved` at creation time to bypass the municipal workflow.
```json
{
  "id": "bad_report_102",
  "ticketId": "CIVIC-123457",
  "image": "data:image/png;base64,...",
  "category": "Pothole & Roads",
  "description": "Fake issue",
  "locationName": "Bengaluru",
  "status": "Resolved",
  "citizenUpvotes": 100,
  "userId": "attacker_uid",
  "timestamp": "2026-06-22T08:00:00Z"
}
```

### Attack 4: Self-Upvoting Injection
A user tries to initialize upvotes to a million or modify their own report to increment upvotes without standard flow.
```json
{
  "id": "report_103",
  "ticketId": "CIVIC-123458",
  "image": "data:image/png;base64,...",
  "category": "Others",
  "description": "Upvote cheat",
  "locationName": "Mumbai",
  "status": "Submitted",
  "citizenUpvotes": 999999,
  "userId": "attacker_uid",
  "timestamp": "2026-06-22T08:00:00Z"
}
```

### Attack 5: Identity Spoofing in Update
An attacker tries to update the `userId` field of an existing issue to shift blame or ownership.
```json
{
  "userId": "honest_uid"
}
```

### Attack 6: Bypass Validation with "Ghost Fields" (Shadow Update)
An attacker attempts to write an additional field `isAdmin` or `isSuperUser` to `/issues/{issueId}` or `/users/{userId}` to bypass UI logic.
```json
{
  "userId": "attacker_uid",
  "displayName": "Attacker",
  "email": "attacker@evil.com",
  "createdAt": "2026-06-22T08:00:00Z",
  "isAdmin": true
}
```

### Attack 7: Resource Exhaustion with 1MB ID string (ID Poisoning)
An attacker writes an incredibly long malicious ID to exhaust server resources.
```json
{
  "id": "a_repeating_string_of_garbage..."
}
```

### Attack 8: Spoofing Verification Email
Unverified email user tries to register or write to collections despite strict verify rules.
- Auth payload has `email_verified: false` but requests write permissions.

### Attack 9: Modifying Immutable `createdAt` Timestamp
A user tries to backdate a report in an update operation to bypass timeline limits.
```json
{
  "createdAt": "2019-01-01T00:00:00Z"
}
```

### Attack 10: Anonymous Writing Block
An anonymous user session tries to submit an official complaint.
- Auth payload has `isAnonymous: true`.

### Attack 11: Direct Query Scraping (Insecure List)
A user tries to list all user records directly, skipping client-side where filters.
- Direct read query is rejected due to no list privilege.

### Attack 12: Terminal State Tampering
An attacker attempts to modify a resolved ticket back to "Submitted" to trigger municipal re-evaluation.
```json
{
  "status": "Submitted"
}
```

---

## 3. Test Runner Concept

Our test suites run inside our application structure to verify that all operations against Firestore are validated, secure, and properly attributions-guarded. Tests ensure that any payload breaching the above constraints is blocked immediately.
