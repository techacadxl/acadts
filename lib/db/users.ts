// lib/db/users.ts
import { db } from "@/lib/firebase/client";
import { doc, setDoc, getDoc, getDocs, collection, query, where, serverTimestamp, Timestamp } from "firebase/firestore";

export type UserRole = "student" | "admin";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: UserRole;
  createdAt?: Timestamp | null;
};

export interface CreateUserDocumentParams {
  uid: string;
  email: string | null;
  displayName: string | null;
  role?: UserRole;
}

/**
 * Creates or updates a user document in Firestore
 * @param user - User data to create/update
 * @throws {Error} If uid is missing or Firestore operation fails
 */
export async function createUserDocument(
  user: CreateUserDocumentParams
): Promise<void> {
  console.log("[Users DB] createUserDocument called with:", {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  });

  if (!user.uid || typeof user.uid !== "string" || user.uid.trim() === "") {
    const error = new Error("User UID is required and must be a non-empty string");
    console.error("[Users DB] createUserDocument error:", error);
    throw error;
  }

  const userRef = doc(db, "users", user.uid);
  console.log("[Users DB] Creating/updating user document at path: users/", user.uid);

  try {
    await setDoc(
      userRef,
      {
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        role: (user.role ?? "student") as UserRole,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true } // safe to call multiple times
    );
    console.log("[Users DB] User document created/updated successfully");
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to create/update user document in Firestore");
    console.error("[Users DB] Error creating user document:", dbError);
    throw dbError;
  }
}

/**
 * Get user document from Firestore by UID
 * @param uid - User UID
 * @returns User document or null if not found
 */
export async function getUserDocument(uid: string): Promise<AppUser | null> {
  console.log("[Users DB] getUserDocument called with:", uid);

  if (!uid || typeof uid !== "string" || uid.trim() === "") {
    console.error("[Users DB] Invalid UID provided");
    return null;
  }

  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.warn("[Users DB] User document not found for UID:", uid);
      return null;
    }

    const data = userSnap.data();
    return {
      uid: userSnap.id,
      email: data.email ?? null,
      displayName: data.displayName ?? null,
      role: data.role ?? "student",
      createdAt: data.createdAt ?? null,
    };
  } catch (error) {
    console.error("[Users DB] Error getting user document:", error);
    return null;
  }
}

/**
 * Get multiple user documents by UIDs
 * @param uids - Array of user UIDs
 * @returns Map of UID to AppUser
 */
export async function getUserDocuments(
  uids: string[]
): Promise<Map<string, AppUser>> {
  console.log("[Users DB] getUserDocuments called with:", uids.length, "UIDs");

  const userMap = new Map<string, AppUser>();

  if (!uids || uids.length === 0) {
    return userMap;
  }

  try {
    // Fetch all user documents in parallel
    const userPromises = uids.map((uid) => getUserDocument(uid));
    const users = await Promise.all(userPromises);

    users.forEach((user) => {
      if (user) {
        userMap.set(user.uid, user);
      }
    });

    console.log("[Users DB] User documents loaded:", userMap.size);
    return userMap;
  } catch (error) {
    console.error("[Users DB] Error getting user documents:", error);
    return userMap;
  }
}

/**
 * Get all students (users with role "student")
 * @returns Array of student users
 */
export async function getAllStudents(): Promise<AppUser[]> {
  console.log("[Users DB] getAllStudents called");

  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("role", "==", "student"));
    const snapshot = await getDocs(q);

    const students: AppUser[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        uid: docSnap.id,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        role: data.role ?? "student",
        createdAt: data.createdAt ?? null,
      };
    });

    console.log("[Users DB] All students loaded:", students.length);
    return students;
  } catch (error) {
    console.error("[Users DB] Error getting all students:", error);
    return [];
  }
}
