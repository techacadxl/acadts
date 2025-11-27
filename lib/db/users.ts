// lib/db/users.ts
import { db } from "@/lib/firebase/client";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt?: any;
};

export async function createUserDocument(user: AppUser) {
  if (!user.uid) return;

  const userRef = doc(db, "users", user.uid);

  await setDoc(
    userRef,
    {
      email: user.email,
      displayName: user.displayName,
      createdAt: serverTimestamp(),
    },
    { merge: true } // safe to call multiple times
  );
}
