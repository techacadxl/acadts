// src/lib/firebase/client.ts
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Validate required environment variables
const requiredEnvVars = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required Firebase environment variables: ${missingVars.join(", ")}`
  );
}

const firebaseConfig = {
  apiKey: requiredEnvVars.apiKey!,
  authDomain: requiredEnvVars.authDomain!,
  projectId: requiredEnvVars.projectId!,
  storageBucket: requiredEnvVars.storageBucket!,
  messagingSenderId: requiredEnvVars.messagingSenderId!,
  appId: requiredEnvVars.appId!,
};

// Avoid re-initializing during hot reloads in dev
const existingApps = getApps();
console.log("[Firebase Client] Existing apps count:", existingApps.length);

let app: FirebaseApp;
if (!existingApps.length) {
  app = initializeApp(firebaseConfig);
  console.log("[Firebase Client] Firebase app initialized:", {
    appName: app.name,
    projectId: firebaseConfig.projectId,
  });
} else {
  app = getApp();
  console.log("[Firebase Client] Using existing Firebase app:", app.name);
}

export const firebaseApp: FirebaseApp = app;
export const auth: Auth = getAuth(app);

// Set persistence to LOCAL (persists until explicitly signed out)
// Firebase Auth tokens are automatically refreshed, and we'll handle 90-day expiration
// by checking token expiration in the auth state listener
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("[Firebase Client] Error setting persistence:", error);
});

export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
console.log("[Firebase Client] Firebase services initialized (auth, firestore, storage)");
