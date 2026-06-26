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
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleAuthProvider = new GoogleAuthProvider();

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
