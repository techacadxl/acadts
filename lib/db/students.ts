// lib/db/students.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { TestSeries } from "@/lib/types/testSeries";
import { getTestSeriesById, listTestSeries } from "./testSeries";
import { getTestById } from "./tests";

const ENROLLMENTS_COLLECTION = "enrollments";

export interface Enrollment {
  id: string;
  userId: string;
  testSeriesId: string;
  enrolledAt: any; // Timestamp
  status: "active" | "expired" | "cancelled";
}

export interface EnrollmentWithSeries extends Enrollment {
  testSeries?: TestSeries;
}

/**
 * Enroll a student in a test series (free enrollment)
 */
export async function enrollInTestSeries(
  userId: string,
  testSeriesId: string
): Promise<string> {
  console.log("[Students DB] enrollInTestSeries called:", { userId, testSeriesId });

  if (!userId || !testSeriesId) {
    throw new Error("userId and testSeriesId are required");
  }

  // Check if already enrolled
  const existingEnrollment = await getEnrollment(userId, testSeriesId);
  if (existingEnrollment) {
    console.log("[Students DB] Already enrolled, returning existing enrollment id");
    return existingEnrollment.id;
  }

  try {
    const enrollmentRef = collection(db, ENROLLMENTS_COLLECTION);
    const docRef = await addDoc(enrollmentRef, {
      userId,
      testSeriesId,
      enrolledAt: serverTimestamp(),
      status: "active",
    });
    console.log("[Students DB] Enrollment created:", docRef.id);
    return docRef.id;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to enroll in test series");
    console.error("[Students DB] Error enrolling:", dbError);
    throw dbError;
  }
}

/**
 * Get enrollment for a user and test series
 */
export async function getEnrollment(
  userId: string,
  testSeriesId: string
): Promise<Enrollment | null> {
  console.log("[Students DB] getEnrollment called:", { userId, testSeriesId });

  try {
    const q = query(
      collection(db, ENROLLMENTS_COLLECTION),
      where("userId", "==", userId),
      where("testSeriesId", "==", testSeriesId)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Enrollment;
  } catch (error) {
    console.error("[Students DB] Error getting enrollment:", error);
    return null;
  }
}

/**
 * Get all enrollments for a user
 */
export async function getUserEnrollments(
  userId: string
): Promise<EnrollmentWithSeries[]> {
  console.log("[Students DB] getUserEnrollments called:", userId);

  try {
    const q = query(
      collection(db, ENROLLMENTS_COLLECTION),
      where("userId", "==", userId),
      where("status", "==", "active")
    );
    const snapshot = await getDocs(q);
    
    const enrollments: EnrollmentWithSeries[] = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const enrollment: EnrollmentWithSeries = {
          id: docSnap.id,
          userId: data.userId,
          testSeriesId: data.testSeriesId,
          enrolledAt: data.enrolledAt,
          status: data.status,
        };

        // Fetch test series details
        try {
          const testSeries = await getTestSeriesById(data.testSeriesId);
          enrollment.testSeries = testSeries || undefined;
        } catch (err) {
          console.error("[Students DB] Error fetching test series:", err);
        }

        return enrollment;
      })
    );

    console.log("[Students DB] User enrollments loaded:", enrollments.length);
    return enrollments;
  } catch (error) {
    console.error("[Students DB] Error getting user enrollments:", error);
    return [];
  }
}

/**
 * Check if user is enrolled in a test series
 */
export async function isEnrolled(
  userId: string,
  testSeriesId: string
): Promise<boolean> {
  const enrollment = await getEnrollment(userId, testSeriesId);
  return enrollment !== null && enrollment.status === "active";
}

/**
 * Get all available test series (for student view)
 */
export async function getAvailableTestSeries(): Promise<TestSeries[]> {
  return listTestSeries();
}

