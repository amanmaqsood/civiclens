export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

export interface FirebaseWebConfigResolution {
  config: FirebaseWebConfig;
  source: "vite-env";
}

export type FirebaseWebConfigMetadata = Partial<FirebaseWebConfig>;

const REQUIRED_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export function resolveFirebaseWebConfig(
  env: Record<string, string | undefined>,
  fallbackConfig: FirebaseWebConfigMetadata
): FirebaseWebConfigResolution {
  const firestoreDatabaseId = env.VITE_FIRESTORE_DATABASE_ID || fallbackConfig.firestoreDatabaseId || "(default)";
  const hasAnyEnvConfig = REQUIRED_ENV_KEYS.some((key) => !!env[key])
    || !!env.VITE_FIREBASE_STORAGE_BUCKET
    || !!env.VITE_FIREBASE_MESSAGING_SENDER_ID
    || !!env.VITE_FIREBASE_MEASUREMENT_ID;

  if (!hasAnyEnvConfig) {
    throw new Error(
      "Firebase web config must be supplied with VITE_FIREBASE_* env vars. " +
        "firebase-applet-config.json is metadata-only and must not contain browser keys.",
    );
  }

  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Incomplete Firebase web config. Missing ${missing.join(", ")}.`);
  }

  return {
    source: "vite-env",
    config: {
      apiKey: env.VITE_FIREBASE_API_KEY!,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN!,
      projectId: env.VITE_FIREBASE_PROJECT_ID!,
      appId: env.VITE_FIREBASE_APP_ID!,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
      measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || fallbackConfig.measurementId,
      firestoreDatabaseId,
    },
  };
}

export function shouldInitializeFirebaseAppCheck(env: Record<string, string | undefined>): boolean {
  return !!env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
}
