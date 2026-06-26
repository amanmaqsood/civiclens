import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/storage";

const root = process.cwd();
const runEmulatorSuite = process.env.CIVICLENS_EMULATOR_TESTS === "true";
const describeEmulator = runEmulatorSuite ? describe : describe.skip;

function readProjectFile(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function uploadRaw(ref: firebase.storage.Reference, data: string, contentType: string): Promise<unknown> {
  const task = ref.putString(data, "raw", { contentType });
  return new Promise((resolve, reject) => {
    task.on("state_changed", undefined, reject, () => resolve(task.snapshot));
  });
}

describeEmulator("Firebase emulator security rules", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-civiclens",
      firestore: {
        rules: readProjectFile("firestore.rules"),
      },
      storage: {
        rules: readProjectFile("storage.rules"),
      },
    });
  }, 30000);

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().collection("issues").doc("issue-1").set({
        id: "issue-1",
        title: "Demo pothole",
        category: "pothole",
        description: "Synthetic report for emulator tests.",
        status: "Submitted",
        timestamp: new Date("2026-06-26T00:00:00.000Z").toISOString(),
        userId: "alice",
        isDemoData: true,
      });
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows signed-in issue reads while denying anonymous and privileged client writes", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const anonymous = testEnv.unauthenticatedContext();

    await assertFails(anonymous.firestore().collection("issues").doc("issue-1").get());
    await assertSucceeds(alice.firestore().collection("issues").doc("issue-1").get());
    await assertSucceeds(alice.firestore().collection("issues").get());

    await assertFails(alice.firestore().collection("issues").doc("issue-2").set({
      title: "Client-created issue",
      status: "Submitted",
      userId: "alice",
    }));
    await assertFails(alice.firestore().collection("issues").doc("issue-1").update({
      status: "Resolved",
      resolvedAt: new Date().toISOString(),
    }));
    await assertFails(alice.firestore().collection("issues").doc("issue-1").collection("agentSteps").add({
      tool: "agent.finalize",
      status: "done",
    }));
  });

  it("lets users maintain only their own non-privileged profile fields", async () => {
    const alice = testEnv.authenticatedContext("alice");

    await assertSucceeds(alice.firestore().collection("users").doc("alice").set({
      userId: "alice",
      displayName: "Alice",
    }));

    await assertFails(alice.firestore().collection("users").doc("bob").set({
      userId: "bob",
      displayName: "Bob",
    }));

    await assertFails(alice.firestore().collection("users").doc("alice").set({
      userId: "alice",
      displayName: "Alice",
      role: "operator",
    }));
  });

  it("limits Storage writes to signed-in owner image paths with accepted MIME and size", async () => {
    const alice = testEnv.authenticatedContext("alice");
    const bob = testEnv.authenticatedContext("bob");
    const anonymous = testEnv.unauthenticatedContext();
    const aliceStorage = alice.storage("gs://demo-civiclens.appspot.com");
    const bobStorage = bob.storage("gs://demo-civiclens.appspot.com");
    const anonymousStorage = anonymous.storage("gs://demo-civiclens.appspot.com");

    await assertSucceeds(uploadRaw(aliceStorage.ref("reports/alice/issue-1/photo.jpg"), "image-bytes", "image/jpeg"));

    await assertFails(uploadRaw(bobStorage.ref("reports/alice/issue-1/photo.jpg"), "not-owner", "image/jpeg"));

    await assertFails(uploadRaw(anonymousStorage.ref("reports/alice/issue-1/photo.jpg"), "anonymous", "image/jpeg"));

    await assertFails(uploadRaw(aliceStorage.ref("reports/alice/issue-1/note.txt"), "plain text", "text/plain"));

    await assertFails(uploadRaw(aliceStorage.ref("reports/alice/issue-1/large.png"), "x".repeat((5 * 1024 * 1024) + 1), "image/png"));

    await assertSucceeds(uploadRaw(aliceStorage.ref("closures/alice/issue-1/after.webp"), "after-image", "image/webp"));

    await assertFails(uploadRaw(aliceStorage.ref("system/alice/issue-1/photo.jpg"), "wrong-path", "image/jpeg"));

    expect(testEnv.emulators.firestore).toBeDefined();
    expect(testEnv.emulators.storage).toBeDefined();
  });
});
