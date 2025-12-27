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
import { cache, cacheKeys } from "@/lib/utils/cache";

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
    // Invalidate cache
    cache.invalidate(cacheKeys.enrollments(userId));
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

  // Check cache first
  const cacheKey = cacheKeys.enrollments(userId);
  const cached = cache.get<EnrollmentWithSeries[]>(cacheKey);
  if (cached) {
    console.log("[Students DB] Enrollments loaded from cache");
    return cached;
  }

  try {
    const q = query(
      collection(db, ENROLLMENTS_COLLECTION),
      where("userId", "==", userId),
      where("status", "==", "active")
    );
    const snapshot = await getDocs(q);
    
    // Batch fetch all test series IDs first
    const testSeriesIds = snapshot.docs.map((docSnap) => docSnap.data().testSeriesId);
    const testSeriesMap = new Map<string, TestSeries>();
    
    // Fetch all test series in parallel
    await Promise.all(
      testSeriesIds.map(async (testSeriesId) => {
        try {
          const testSeries = await getTestSeriesById(testSeriesId);
          if (testSeries) {
            testSeriesMap.set(testSeriesId, testSeries);
          }
        } catch (err) {
          console.error("[Students DB] Error fetching test series:", err);
        }
      })
    );
    
    const enrollments: EnrollmentWithSeries[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const enrollment: EnrollmentWithSeries = {
        id: docSnap.id,
        userId: data.userId,
        testSeriesId: data.testSeriesId,
        enrolledAt: data.enrolledAt,
        status: data.status,
        testSeries: testSeriesMap.get(data.testSeriesId),
      };
      return enrollment;
    });

    // Cache for 5 minutes (balance between freshness and performance)
    cache.set(cacheKey, enrollments, 5 * 60 * 1000);
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

/**
 * Get all enrollments for a specific test series
 */
export async function getTestSeriesEnrollments(
  testSeriesId: string
): Promise<Enrollment[]> {
  console.log("[Students DB] getTestSeriesEnrollments called:", testSeriesId);

  if (!testSeriesId) {
    console.error("[Students DB] testSeriesId is required");
    return [];
  }

  try {
    const q = query(
      collection(db, ENROLLMENTS_COLLECTION),
      where("testSeriesId", "==", testSeriesId),
      where("status", "==", "active")
    );
    const snapshot = await getDocs(q);
    
    const enrollments: Enrollment[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId,
        testSeriesId: data.testSeriesId,
        enrolledAt: data.enrolledAt,
        status: data.status,
      } as Enrollment;
    });

    console.log("[Students DB] Test series enrollments loaded:", enrollments.length);
    return enrollments;
  } catch (error) {
    console.error("[Students DB] Error getting test series enrollments:", error);
    return [];
  }
}

