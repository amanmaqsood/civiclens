export interface FirebaseAdminRuntimeConfig {
  projectId: string | undefined;
  databaseId: string;
  appOptions: {
    projectId?: string;
  };
}

export function resolveFirebaseAdminConfig(env: Record<string, string | undefined>): FirebaseAdminRuntimeConfig {
  const projectId = env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || undefined;
  const databaseId = env.FIRESTORE_DATABASE_ID || "(default)";

  return {
    projectId,
    databaseId,
    appOptions: projectId ? { projectId } : {},
  };
}

export function isDefaultFirestoreDatabase(databaseId: string): boolean {
  return !databaseId || databaseId === "(default)";
}
