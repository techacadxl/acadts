// lib/db/testResults.ts
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
import type { TestResult, TestResultDoc, TestResultInput } from "@/lib/types/testResult";

const TEST_RESULTS_COLLECTION = "testResults";

function testResultsCollectionRef() {
  return collection(db, TEST_RESULTS_COLLECTION);
}

function mapTestResultDoc(
  snapshot: QueryDocumentSnapshot | DocumentSnapshot
): TestResult {
  const data = snapshot.data();
  if (!data) {
    throw new Error("Test result document data is missing");
  }

  return {
    id: snapshot.id,
    ...data,
  } as TestResult;
}

/**
 * Create a new test result document
 * @param input - Test result data from submission
 * @returns The newly created test result document id
 */
export async function createTestResult(
  input: TestResultInput
): Promise<string> {
  console.log("[TestResults DB] createTestResult called with:", input);

  if (!input.testId || !input.userId) {
    const error = new Error("testId and userId are required");
    console.error("[TestResults DB] createTestResult error:", error);
    throw error;
  }

  const docData: Omit<TestResultDoc, "submittedAt"> & {
    submittedAt: ReturnType<typeof serverTimestamp>;
  } = {
    ...input,
    submittedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(testResultsCollectionRef(), docData);
    console.log("[TestResults DB] Test result created with id:", docRef.id);
    return docRef.id;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to create test result in Firestore");
    console.error("[TestResults DB] Error creating test result:", dbError);
    throw dbError;
  }
}

/**
 * Get a test result by document ID
 * @param id - Test result document ID
 * @returns Test result or null if not found
 */
export async function getTestResultById(id: string): Promise<TestResult | null> {
  console.log("[TestResults DB] getTestResultById called with:", id);

  if (!id || typeof id !== "string" || id.trim() === "") {
    console.error("[TestResults DB] Invalid id provided");
    return null;
  }

  try {
    const docRef = doc(db, TEST_RESULTS_COLLECTION, id);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      console.log("[TestResults DB] Test result not found");
      return null;
    }

    return mapTestResultDoc(snapshot);
  } catch (error) {
    console.error("[TestResults DB] Error getting test result:", error);
    return null;
  }
}

/**
 * Get all test results for a specific user
 * @param userId - User ID
 * @returns Array of test results
 */
export async function getUserTestResults(
  userId: string
): Promise<TestResult[]> {
  console.log("[TestResults DB] getUserTestResults called with:", userId);

  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    console.error("[TestResults DB] Invalid userId provided");
    return [];
  }

  try {
    const q = query(
      testResultsCollectionRef(),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => mapTestResultDoc(doc));
  } catch (error) {
    console.error("[TestResults DB] Error getting user test results:", error);
    return [];
  }
}

/**
 * Get all test results for a specific test
 * @param testId - Test ID
 * @returns Array of test results
 */
export async function getTestResultsByTestId(
  testId: string
): Promise<TestResult[]> {
  console.log("[TestResults DB] getTestResultsByTestId called with:", testId);

  if (!testId || typeof testId !== "string" || testId.trim() === "") {
    console.error("[TestResults DB] Invalid testId provided");
    return [];
  }

  try {
    const q = query(
      testResultsCollectionRef(),
      where("testId", "==", testId)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => mapTestResultDoc(doc));
  } catch (error) {
    console.error("[TestResults DB] Error getting test results by testId:", error);
    return [];
  }
}

/**
 * Get a test result for a specific user and test
 * @param userId - User ID
 * @param testId - Test ID
 * @returns Test result or null if not found
 */
export async function getUserTestResult(
  userId: string,
  testId: string
): Promise<TestResult | null> {
  console.log("[TestResults DB] getUserTestResult called with:", { userId, testId });

  if (!userId || !testId) {
    console.error("[TestResults DB] userId and testId are required");
    return null;
  }

  try {
    const q = query(
      testResultsCollectionRef(),
      where("userId", "==", userId),
      where("testId", "==", testId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    // Return the most recent result if multiple exist
    const results = snapshot.docs.map((doc) => mapTestResultDoc(doc));
    return results.sort((a, b) => {
      const aTime = a.submittedAt?.toMillis() || 0;
      const bTime = b.submittedAt?.toMillis() || 0;
      return bTime - aTime;
    })[0];
  } catch (error) {
    console.error("[TestResults DB] Error getting user test result:", error);
    return null;
  }
}

