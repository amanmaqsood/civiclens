import { describe, expect, it } from "vitest";
import {
  resolveFirebaseWebConfig,
  shouldInitializeFirebaseAppCheck,
  type FirebaseWebConfigMetadata,
} from "./firebase-config";

const fallbackConfig: FirebaseWebConfigMetadata = {
  authDomain: "fallback.firebaseapp.com",
  projectId: "fallback-project",
  appId: "fallback-app-id",
  storageBucket: "fallback.appspot.com",
  messagingSenderId: "sender",
  measurementId: "measurement",
  firestoreDatabaseId: "fallback-db",
};

describe("Firebase web config resolution", () => {
  it("fails closed when no Vite Firebase browser config is provided", () => {
    expect(() => resolveFirebaseWebConfig({}, fallbackConfig)).toThrow(/VITE_FIREBASE_\*/);
  });

  it("uses complete Vite env config and keeps optional fallback fields", () => {
    const result = resolveFirebaseWebConfig({
      VITE_FIREBASE_API_KEY: "env-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "env.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "env-project",
      VITE_FIREBASE_APP_ID: "env-app-id",
    }, fallbackConfig);

    expect(result.source).toBe("vite-env");
    expect(result.config).toMatchObject({
      apiKey: "env-api-key",
      authDomain: "env.firebaseapp.com",
      projectId: "env-project",
      appId: "env-app-id",
      storageBucket: "fallback.appspot.com",
      firestoreDatabaseId: "fallback-db",
    });
  });

  it("fails closed when only part of the Firebase browser config is provided", () => {
    expect(() => resolveFirebaseWebConfig({
      VITE_FIREBASE_PROJECT_ID: "partial-project",
    }, fallbackConfig)).toThrow(/Incomplete Firebase web config/);
  });

  it("allows a Firestore database id override with the checked-in fallback app config", () => {
    const result = resolveFirebaseWebConfig({
      VITE_FIREBASE_API_KEY: "env-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "env.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "env-project",
      VITE_FIREBASE_APP_ID: "env-app-id",
      VITE_FIRESTORE_DATABASE_ID: "named-db",
    }, fallbackConfig);

    expect(result.source).toBe("vite-env");
    expect(result.config.projectId).toBe("env-project");
    expect(result.config.firestoreDatabaseId).toBe("named-db");
  });

  it("initializes App Check only when a site key is configured", () => {
    expect(shouldInitializeFirebaseAppCheck({})).toBe(false);
    expect(shouldInitializeFirebaseAppCheck({ VITE_FIREBASE_APP_CHECK_SITE_KEY: "" })).toBe(false);
    expect(shouldInitializeFirebaseAppCheck({ VITE_FIREBASE_APP_CHECK_SITE_KEY: "site-key" })).toBe(true);
  });
});
