// /context/AuthContext.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, onAuthStateChanged, Unsubscribe, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

// 90 days in milliseconds
const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000;
const LOGIN_TIME_KEY = "user_login_time";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AuthContext] Setting up auth state listener");
    
    const handleAuthStateChange = async (firebaseUser: User | null) => {
      console.log("[AuthContext] Auth state changed:", {
        hasUser: !!firebaseUser,
        userId: firebaseUser?.uid,
        email: firebaseUser?.email,
      });

      if (firebaseUser) {
        // Check if session has expired (90 days)
        const loginTimeStr = localStorage.getItem(LOGIN_TIME_KEY);
        if (loginTimeStr) {
          const loginTime = parseInt(loginTimeStr, 10);
          const now = Date.now();
          const timeSinceLogin = now - loginTime;

          if (timeSinceLogin > SESSION_DURATION_MS) {
            console.log("[AuthContext] Session expired (90 days), signing out");
            localStorage.removeItem(LOGIN_TIME_KEY);
            await signOut(auth);
            setUser(null);
            setLoading(false);
            return;
          }
        } else {
          // First time login or login time not set, set it now
          localStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());
        }
      } else {
        // User signed out, clear login time
        localStorage.removeItem(LOGIN_TIME_KEY);
      }

      setUser(firebaseUser);
      setLoading(false);
      console.log("[AuthContext] Loading state set to false");
    };

    const unsubscribe: Unsubscribe = onAuthStateChanged(auth, handleAuthStateChange);

    // Also check session expiration periodically (every hour)
    const expirationCheckInterval = setInterval(() => {
      const loginTimeStr = localStorage.getItem(LOGIN_TIME_KEY);
      if (loginTimeStr && auth.currentUser) {
        const loginTime = parseInt(loginTimeStr, 10);
        const now = Date.now();
        const timeSinceLogin = now - loginTime;

        if (timeSinceLogin > SESSION_DURATION_MS) {
          console.log("[AuthContext] Session expired during periodic check, signing out");
          localStorage.removeItem(LOGIN_TIME_KEY);
          signOut(auth);
        }
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => {
      console.log("[AuthContext] Cleaning up auth state listener");
      unsubscribe();
      clearInterval(expirationCheckInterval);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
