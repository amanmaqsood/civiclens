import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import "firebase/compat/firestore";

const runEmulatorSuite = process.env.CIVICLENS_EMULATOR_TESTS === "true";
const describeEmulator = runEmulatorSuite ? describe : describe.skip;

describeEmulator("Firestore emulator transaction concurrency", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-civiclens",
      firestore: {
        rules: "service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }",
      },
    });
  }, 30000);

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("issues").doc("issue-1").set({
        id: "issue-1",
        status: "submitted",
        citizenUpvotes: 0,
        confirmCount: 0,
        disputeCount: 0,
      });
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows only one support action for one user under concurrent attempts", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const issueRef = db.collection("issues").doc("issue-1");

      async function supportOnce(userId: string): Promise<boolean> {
        return db.runTransaction(async (tx) => {
          const supportRef = issueRef.collection("support").doc(userId);
          const existing = await tx.get(supportRef);
          if (existing.exists) return false;

          const issueSnap = await tx.get(issueRef);
          const current = issueSnap.data()?.citizenUpvotes || 0;
          tx.set(supportRef, { userId, timestamp: "2026-06-26T00:00:00.000Z" });
          tx.update(issueRef, { citizenUpvotes: current + 1 });
          return true;
        });
      }

      const results = await Promise.all(Array.from({ length: 8 }, () => supportOnce("alice")));
      const finalSnap = await issueRef.get();
      const supportSnap = await issueRef.collection("support").get();

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(finalSnap.data()?.citizenUpvotes).toBe(1);
      expect(supportSnap.size).toBe(1);
    });
  });

  it("allows only one verification action for one user under conflicting concurrent attempts", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const issueRef = db.collection("issues").doc("issue-1");

      async function verifyOnce(userId: string, type: "confirm" | "dispute"): Promise<boolean> {
        return db.runTransaction(async (tx) => {
          const verificationRef = issueRef.collection("verifications").doc(userId);
          const existing = await tx.get(verificationRef);
          if (existing.exists) return false;

          const issueSnap = await tx.get(issueRef);
          const data = issueSnap.data() || {};
          const confirmCount = data.confirmCount || 0;
          const disputeCount = data.disputeCount || 0;
          tx.set(verificationRef, { userId, type, timestamp: "2026-06-26T00:00:00.000Z" });
          tx.update(issueRef, {
            confirmCount: type === "confirm" ? confirmCount + 1 : confirmCount,
            disputeCount: type === "dispute" ? disputeCount + 1 : disputeCount,
            verificationStatus: type === "confirm" ? "community_confirmed" : "community_disputed",
          });
          return true;
        });
      }

      const results = await Promise.all([
        verifyOnce("alice", "confirm"),
        verifyOnce("alice", "dispute"),
        verifyOnce("alice", "confirm"),
        verifyOnce("alice", "dispute"),
      ]);
      const finalSnap = await issueRef.get();
      const verificationSnap = await issueRef.collection("verifications").get();
      const finalData = finalSnap.data() || {};

      expect(results.filter(Boolean)).toHaveLength(1);
      expect((finalData.confirmCount || 0) + (finalData.disputeCount || 0)).toBe(1);
      expect(verificationSnap.size).toBe(1);
    });
  });

  it("allows only one duplicate evidence merge for one idempotency key under concurrent attempts", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const issueRef = db.collection("issues").doc("issue-1");

      async function attachEvidenceOnce(evidenceId: string): Promise<boolean> {
        return db.runTransaction(async (tx) => {
          const evidenceRef = issueRef.collection("evidence").doc(evidenceId);
          const existing = await tx.get(evidenceRef);
          if (existing.exists) return false;

          const issueSnap = await tx.get(issueRef);
          const currentCount = issueSnap.data()?.reportCount || 0;
          tx.set(evidenceRef, {
            imageUrl: "storage://demo/evidence.jpg",
            description: "Duplicate evidence",
            submittedBy: "alice",
            timestamp: "2026-06-26T00:00:00.000Z",
          });
          tx.update(issueRef, { reportCount: currentCount + 1 });
          return true;
        });
      }

      const results = await Promise.all(Array.from({ length: 6 }, () => attachEvidenceOnce("evidence-1")));
      const finalSnap = await issueRef.get();
      const evidenceSnap = await issueRef.collection("evidence").get();

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(finalSnap.data()?.reportCount).toBe(1);
      expect(evidenceSnap.size).toBe(1);
    });
  });

  it("allows only one legal status transition under concurrent attempts", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const issueRef = db.collection("issues").doc("issue-1");

      async function transitionToVerified(operatorId: string): Promise<boolean> {
        return db.runTransaction(async (tx) => {
          const issueSnap = await tx.get(issueRef);
          const currentStatus = issueSnap.data()?.status;
          if (currentStatus !== "submitted") return false;

          tx.update(issueRef, {
            status: "verified",
            triagedAt: "2026-06-26T00:00:00.000Z",
            updatedAt: "2026-06-26T00:00:00.000Z",
          });
          tx.set(issueRef.collection("approvals").doc(), {
            type: "status_transition",
            fromStatus: "submitted",
            toStatus: "verified",
            humanApproved: true,
            byUid: operatorId,
          });
          tx.set(issueRef.collection("activity").doc(), {
            actorType: "operator",
            eventType: "status_changed",
            byUid: operatorId,
          });
          return true;
        });
      }

      const results = await Promise.all(Array.from({ length: 5 }, () => transitionToVerified("operator-1")));
      const finalSnap = await issueRef.get();
      const approvalSnap = await issueRef.collection("approvals").get();
      const activitySnap = await issueRef.collection("activity").get();

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(finalSnap.data()?.status).toBe("verified");
      expect(approvalSnap.size).toBe(1);
      expect(activitySnap.size).toBe(1);
    });
  });
});
