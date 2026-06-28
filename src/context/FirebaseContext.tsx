import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  getRedirectResult,
  signInWithPopup, 
  signInWithRedirect,
  signOut,
  signInAnonymously
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleAuthProvider, handleFirestoreError, OperationType } from "../lib/firebase";

interface FirebaseContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      console.warn("Google redirect sign-in warning:", error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Failed to sign in anonymously:", error);
          setLoading(false);
        }
        return;
      }

      setUser(currentUser);
      
      // Sync user profile to Firestore
      const userRef = doc(db, "users", currentUser.uid);
      try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            userId: currentUser.uid,
            displayName: currentUser.displayName || (currentUser.isAnonymous ? "Anonymous Citizen" : "Google Citizen"),
            email: currentUser.email || "",
            createdAt: new Date().toISOString()
          });
        }
      } catch (error) {
        // Gracefully log on sync issues
        console.warn("User sync warning: ", error);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const isMobileViewport =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(max-width: 767px)").matches || /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent));

    try {
      if (isMobileViewport) {
        await signInWithRedirect(auth, googleAuthProvider);
        return;
      }
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error: any) {
      console.warn("Google sign-in warning:", error);
      const code = String(error?.code || "");
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        await signInWithRedirect(auth, googleAuthProvider);
        return;
      }
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.warn("Sign out warning:", error);
      throw error;
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, loading, signInWithGoogle, signOutUser }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
}
