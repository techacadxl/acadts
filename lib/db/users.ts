// lib/db/users.ts
import { db } from "@/lib/firebase/client";
import { doc, setDoc, getDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";

export type AppUser = {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  createdAt?: any;
  role?: string;
};

export async function createUserDocument(user: AppUser) {
  if (!user.uid) return;

  const userRef = doc(db, "users", user.uid);

  await setDoc(
    userRef,
    {
      email: user.email,
      phoneNumber: user.phoneNumber,
      displayName: user.displayName,
      createdAt: serverTimestamp(),
    },
    { merge: true } // safe to call multiple times
  );
}

/**
 * Get user document by ID
 */
export async function getUserDocument(uid: string): Promise<AppUser | null> {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return null;
    }
    
    return {
      uid: userSnap.id,
      ...userSnap.data(),
    } as AppUser;
  } catch (error) {
    console.error("[Users DB] Error getting user document:", error);
    return null;
  }
}

/**
 * Get multiple user documents by their UIDs
 * Returns a Map of uid -> AppUser for quick lookup
 */
export async function getUserDocuments(uids: string[]): Promise<Map<string, AppUser>> {
  const userMap = new Map<string, AppUser>();
  
  if (!uids || uids.length === 0) {
    return userMap;
  }

  try {
    // Fetch users in parallel
    const userPromises = uids.map(async (uid) => {
      const user = await getUserDocument(uid);
      if (user) {
        userMap.set(uid, user);
      }
    });
    
    await Promise.all(userPromises);
    
    return userMap;
  } catch (error) {
    console.error("[Users DB] Error getting user documents:", error);
    return userMap;
  }
}

/**
 * Get all users (for admin)
 */
export async function getAllUsers(): Promise<AppUser[]> {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    
    const users: AppUser[] = [];
    snapshot.forEach((doc) => {
      users.push({
        uid: doc.id,
        ...doc.data(),
      } as AppUser);
    });
    
    // Sort by createdAt (newest first)
    users.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return bTime - aTime;
    });
    
    return users;
  } catch (error) {
    console.error("[Users DB] Error getting all users:", error);
    return [];
  }
}
