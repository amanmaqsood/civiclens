import { describe, expect, it } from "vitest";
import { isDefaultFirestoreDatabase, resolveFirebaseAdminConfig } from "./admin-config";

describe("Firebase Admin runtime config", () => {
  it("uses explicit Firebase project id before Cloud Run fallbacks", () => {
    const config = resolveFirebaseAdminConfig({
      FIREBASE_PROJECT_ID: "firebase-project",
      GOOGLE_CLOUD_PROJECT: "google-cloud-project",
      GCLOUD_PROJECT: "gcloud-project",
      FIRESTORE_DATABASE_ID: "named-db",
    });

    expect(config.projectId).toBe("firebase-project");
    expect(config.appOptions).toEqual({ projectId: "firebase-project" });
    expect(config.databaseId).toBe("named-db");
  });

  it("falls back to Cloud Run project variables and default database", () => {
    expect(resolveFirebaseAdminConfig({ GOOGLE_CLOUD_PROJECT: "cloud-run-project" })).toEqual({
      projectId: "cloud-run-project",
      databaseId: "(default)",
      appOptions: { projectId: "cloud-run-project" },
    });

    expect(resolveFirebaseAdminConfig({ GCLOUD_PROJECT: "legacy-project" }).projectId).toBe("legacy-project");
  });

  it("allows ADC project discovery when no project env is provided", () => {
    const config = resolveFirebaseAdminConfig({});

    expect(config.projectId).toBeUndefined();
    expect(config.appOptions).toEqual({});
    expect(config.databaseId).toBe("(default)");
  });

  it("recognizes the default Firestore database id", () => {
    expect(isDefaultFirestoreDatabase("(default)")).toBe(true);
    expect(isDefaultFirestoreDatabase("")).toBe(true);
    expect(isDefaultFirestoreDatabase("named-db")).toBe(false);
  });
});
