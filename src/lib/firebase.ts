import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  User as FirebaseUser,
  connectAuthEmulator
} from "firebase/auth";
import {
  getToken as getAppCheckToken,
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import { 
  initializeFirestore, 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  getDocFromServer,
  limit,
  connectFirestoreEmulator
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import fallbackFirebaseConfig from "../../firebase-applet-config.json";
import { resolveFirebaseWebConfig, shouldInitializeFirebaseAppCheck } from "./firebase-config";

const firebaseConfigResolution = resolveFirebaseWebConfig((import.meta as any).env || {}, fallbackFirebaseConfig);
const firebaseConfig = firebaseConfigResolution.config;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let appCheck: AppCheck | null = null;

if (shouldInitializeFirebaseAppCheck((import.meta as any).env || {})) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider((import.meta as any).env.VITE_FIREBASE_APP_CHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

// Initialize Services
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleAuthProvider = new GoogleAuthProvider();

export async function getFirebaseAppCheckToken(): Promise<string | null> {
  if (!appCheck) return null;
  try {
    const result = await getAppCheckToken(appCheck);
    return result.token || null;
  } catch (error) {
    console.warn("Firebase App Check token unavailable.", error);
    return null;
  }
}

function envPort(name: string, fallback: number): number {
  const value = Number((import.meta as any).env?.[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

if ((import.meta as any).env?.VITE_CIVICLENS_USE_FIREBASE_EMULATORS === "true") {
  const host = (import.meta as any).env?.VITE_FIREBASE_EMULATOR_HOST || "127.0.0.1";
  connectAuthEmulator(auth, `http://${host}:${envPort("VITE_FIREBASE_AUTH_EMULATOR_PORT", 9099)}`, {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, host, envPort("VITE_FIRESTORE_EMULATOR_PORT", 8080));
  connectStorageEmulator(storage, host, envPort("VITE_FIREBASE_STORAGE_EMULATOR_PORT", 9199));
}

// Error logger for Firestore Permission Denied tracking (Pillar 3 from SKILL.md)
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error("Firestore Error Detailed: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
