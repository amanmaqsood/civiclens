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
});
