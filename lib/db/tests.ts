// lib/db/tests.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  limit,
  startAfter,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { cache, cacheKeys } from "@/lib/utils/cache";
import type {
  Test,
  TestDoc,
  TestInput,
  TestQuestion,
} from "@/lib/types/test";

const TESTS_COLLECTION = "tests";

function testsCollectionRef() {
  return collection(db, TESTS_COLLECTION);
}

/**
 * Maps a Firestore document snapshot to a Test object
 */
function mapTestDoc(
  snapshot: QueryDocumentSnapshot | DocumentSnapshot
): Test {
  const data = snapshot.data() as TestDoc;
  // Backward compatibility: if sections don't exist, create empty array
  const sections = data.sections || [];
  return {
    id: snapshot.id,
    ...data,
    sections,
  };
}

/**
 * Create a new test document
 * @param input - Test data from form (no timestamps / createdBy)
 * @param adminUid - UID of the admin creating the test
 * @returns The newly created test document id
 */
export async function createTest(
  input: TestInput,
  adminUid: string
): Promise<string> {
  console.log("[Tests DB] createTest called with:", {
    input,
    adminUid,
  });

  if (!adminUid || typeof adminUid !== "string" || adminUid.trim() === "") {
    const error = new Error("adminUid is required and must be a non-empty string");
    console.error("[Tests DB] createTest error:", error);
    throw error;
  }

  // Validate input
  if (!input.title || input.title.trim() === "") {
    throw new Error("Test title is required");
  }

  if (input.durationMinutes <= 0) {
    throw new Error("Duration must be a positive number");
  }

  if (!input.questions || input.questions.length === 0) {
    throw new Error("At least one question is required for a test");
  }

  // Validate questions array
  input.questions.forEach((q, index) => {
    if (!q.questionId || q.questionId.trim() === "") {
      throw new Error(`Question ${index + 1} is missing questionId`);
    }
    if (q.marks <= 0) {
      throw new Error(`Question ${index + 1} must have positive marks`);
    }
    if (q.negativeMarks < 0) {
      throw new Error(`Question ${index + 1} cannot have negative marking less than 0`);
    }
  });

  const docData: Omit<TestDoc, "createdAt" | "updatedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    title: input.title.trim(),
    description: input.description.trim(),
    durationMinutes: input.durationMinutes,
    sections: input.sections || [],
    questions: input.questions,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(testsCollectionRef(), docData);
    console.log("[Tests DB] Test created with id:", docRef.id);
    return docRef.id;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to create test in Firestore");
    console.error("[Tests DB] Error creating test:", dbError);
    throw dbError;
  }
}

/**
 * Update an existing test document
 * @param id - Test document id
 * @param updates - Partial test input to update
 */
export async function updateTest(
  id: string,
  updates: Partial<TestInput>
): Promise<void> {
  console.log("[Tests DB] updateTest called with:", { id, updates });

  if (!id || typeof id !== "string" || id.trim() === "") {
    const error = new Error("Test id is required and must be a non-empty string");
    console.error("[Tests DB] updateTest error:", error);
    throw error;
  }

  const testRef = doc(db, TESTS_COLLECTION, id);

  const updateData: Partial<Omit<TestDoc, "updatedAt">> & {
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Clean up undefined values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key as keyof typeof updateData] === undefined) {
      delete updateData[key as keyof typeof updateData];
    }
  });

  // Trim string fields if present
  if (updateData.title !== undefined) {
    updateData.title = updateData.title.trim();
  }
  if (updateData.description !== undefined) {
    updateData.description = updateData.description.trim();
  }

  try {
    await updateDoc(testRef, updateData);
    console.log("[Tests DB] Test updated successfully");
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to update test in Firestore");
    console.error("[Tests DB] Error updating test:", dbError);
    throw dbError;
  }
}

/**
 * Delete a test document
 * @param id - Test document id
 */
export async function deleteTest(id: string): Promise<void> {
  console.log("[Tests DB] deleteTest called with id:", id);

  if (!id || typeof id !== "string" || id.trim() === "") {
    const error = new Error("Test id is required and must be a non-empty string");
    console.error("[Tests DB] deleteTest error:", error);
    throw error;
  }

  const testRef = doc(db, TESTS_COLLECTION, id);

  try {
    await deleteDoc(testRef);
    console.log("[Tests DB] Test deleted successfully");
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to delete test from Firestore");
    console.error("[Tests DB] Error deleting test:", dbError);
    throw dbError;
  }
}

/**
 * Get a single test by id
 * @param id - Test document id
 */
export async function getTestById(id: string): Promise<Test | null> {
  console.log("[Tests DB] getTestById called with id:", id);

  if (!id || typeof id !== "string" || id.trim() === "") {
    const error = new Error("Test id is required and must be a non-empty string");
    console.error("[Tests DB] getTestById error:", error);
    throw error;
  }

  const testRef = doc(db, TESTS_COLLECTION, id);

  try {
    const snap = await getDoc(testRef);
    if (!snap.exists()) {
      console.warn("[Tests DB] Test not found for id:", id);
      return null;
    }

    const test = mapTestDoc(snap);
    console.log("[Tests DB] Test loaded:", { id: test.id });
    return test;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to fetch test from Firestore");
    console.error("[Tests DB] Error fetching test:", dbError);
    throw dbError;
  }
}

/**
 * List all tests
 */
export async function listTests(): Promise<Test[]> {
  console.log("[Tests DB] listTests called");

  // Check cache first
  const cacheKey = cacheKeys.tests({});
  const cached = cache.get<Test[]>(cacheKey);
  if (cached) {
    console.log("[Tests DB] Tests loaded from cache");
    return cached;
  }

  try {
    const qRef = query(
      testsCollectionRef(),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(qRef);
    const tests: Test[] = snapshot.docs.map((docSnap) =>
      mapTestDoc(docSnap)
    );

    // Cache for 5 minutes
    cache.set(cacheKey, tests, 5 * 60 * 1000);

    console.log("[Tests DB] listTests loaded count:", tests.length);
    return tests;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to list tests from Firestore");
    console.error("[Tests DB] Error listing tests:", dbError);
    throw dbError;
  }
}

/**
 * List tests with pagination support
 */
export interface PaginatedTestsResult {
  tests: Test[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  total?: number;
}

export async function listTestsPaginated(
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedTestsResult> {
  console.log("[Tests DB] listTestsPaginated called", { page, pageSize });

  const cacheKey = cacheKeys.tests({ page, pageSize });
  const cached = cache.get<PaginatedTestsResult>(cacheKey);
  if (cached) {
    console.log("[Tests DB] Tests loaded from cache");
    return cached;
  }

  try {
    const constraints: QueryConstraint[] = [
      orderBy("createdAt", "desc"),
      limit(pageSize + 1), // Fetch one extra to check if there's more
    ];

    const qRef = query(testsCollectionRef(), ...constraints);
    const snapshot = await getDocs(qRef);
    const docs = snapshot.docs;

    const hasMore = docs.length > pageSize;
    const testsToReturn = hasMore ? docs.slice(0, pageSize) : docs;
    const lastDoc = testsToReturn.length > 0 ? testsToReturn[testsToReturn.length - 1] : null;

    const tests: Test[] = testsToReturn.map((docSnap) => mapTestDoc(docSnap));

    const result: PaginatedTestsResult = {
      tests,
      lastDoc,
      hasMore,
    };

    // Cache for 5 minutes
    cache.set(cacheKey, result, 5 * 60 * 1000);

    console.log("[Tests DB] listTestsPaginated loaded count:", tests.length, "hasMore:", hasMore);
    return result;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to list tests from Firestore");
    console.error("[Tests DB] Error listing tests:", dbError);
    throw dbError;
  }
}







