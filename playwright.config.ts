import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  timeout: 45_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4174/health",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      PORT: "4174",
      VITE_CIVICLENS_USE_FIREBASE_EMULATORS: "true",
      VITE_FIREBASE_EMULATOR_HOST: "127.0.0.1",
      VITE_FIREBASE_AUTH_EMULATOR_PORT: "9099",
      VITE_FIRESTORE_EMULATOR_PORT: "8080",
      VITE_FIREBASE_STORAGE_EMULATOR_PORT: "9199",
      VITE_FIREBASE_API_KEY: "demo-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-civiclens.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "demo-civiclens",
      VITE_FIREBASE_APP_ID: "1:123456789:web:demo",
      VITE_FIREBASE_STORAGE_BUCKET: "demo-civiclens.appspot.com",
      VITE_FIRESTORE_DATABASE_ID: "(default)",
      FIREBASE_PROJECT_ID: "demo-civiclens",
      FIRESTORE_DATABASE_ID: "(default)",
      CIVICLENS_DEMO_OPERATOR_ENABLED: "true",
      CIVICLENS_LOCAL_APP_CHECK_BYPASS: "true",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
      },
    },
  ],
});
