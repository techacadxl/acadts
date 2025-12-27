// lib/db/testSeries.ts
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
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { TestSeries, TestSeriesDoc, TestSeriesInput } from "@/lib/types/testSeries";
import { cache, cacheKeys } from "@/lib/utils/cache";

const TEST_SERIES_COLLECTION = "testSeries";

function testSeriesCollectionRef() {
  return collection(db, TEST_SERIES_COLLECTION);
}

function mapTestSeriesDoc(
  snapshot: QueryDocumentSnapshot | DocumentSnapshot
): TestSeries {
  const data = snapshot.data() as TestSeriesDoc;
  return {
    id: snapshot.id,
    ...data,
  };
}

export async function createTestSeries(
  input: TestSeriesInput,
  adminUid: string
): Promise<string> {
  console.log("[TestSeries DB] createTestSeries called with:", { input, adminUid });

  if (!adminUid || typeof adminUid !== "string" || adminUid.trim() === "") {
    const error = new Error("adminUid is required and must be a non-empty string");
    console.error("[TestSeries DB] createTestSeries error:", error);
    throw error;
  }

  // Remove undefined values to avoid Firestore errors
  const cleanInput = Object.fromEntries(
    Object.entries(input).filter(([_, value]) => value !== undefined)
  ) as TestSeriesInput;

  const docData: Omit<TestSeriesDoc, "createdAt" | "updatedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    ...cleanInput,
    testIds: cleanInput.testIds || [],
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(testSeriesCollectionRef(), docData);
    // Invalidate cache
    cache.invalidatePattern("^testSeries:");
    cache.invalidate(cacheKeys.publishedTestSeries());
    console.log("[TestSeries DB] TestSeries created with id:", docRef.id);
    return docRef.id;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to create test series in Firestore");
    console.error("[TestSeries DB] Error creating test series:", dbError);
    throw dbError;
  }
}

export async function getTestSeriesById(id: string, bypassCache: boolean = false): Promise<TestSeries | null> {
  console.log("[TestSeries DB] getTestSeriesById called with id:", id, "bypassCache:", bypassCache);
  if (!id || typeof id !== "string" || id.trim() === "") {
    throw new Error("TestSeries id is required and must be a non-empty string");
  }

  // Check cache first (unless bypassing)
  const cacheKey = cacheKeys.testSeriesById(id);
  if (!bypassCache) {
    const cached = cache.get<TestSeries>(cacheKey);
    if (cached) {
      console.log("[TestSeries DB] TestSeries loaded from cache:", id);
      return cached;
    }
  } else {
    // Invalidate cache if bypassing
    cache.invalidate(cacheKey);
    console.log("[TestSeries DB] Cache bypassed for test series:", id);
  }

  const testSeriesRef = doc(db, TEST_SERIES_COLLECTION, id);
  try {
    const snap = await getDoc(testSeriesRef);
    if (!snap.exists()) {
      console.warn("[TestSeries DB] TestSeries not found for id:", id);
      return null;
    }
    const testSeries = mapTestSeriesDoc(snap);
    console.log("[TestSeries DB] TestSeries loaded from Firestore:", { 
      id: testSeries.id, 
      title: testSeries.title,
      testIds: testSeries.testIds,
      testIdsLength: testSeries.testIds?.length 
    });
    // Cache for 15 minutes (test series change less frequently)
    cache.set(cacheKey, testSeries, 15 * 60 * 1000);
    return testSeries;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to fetch test series from Firestore");
    console.error("[TestSeries DB] Error fetching test series:", dbError);
    throw dbError;
  }
}

export async function listTestSeries(): Promise<TestSeries[]> {
  console.log("[TestSeries DB] listTestSeries called");
  
  // Check cache first
  const cacheKey = cacheKeys.testSeries({});
  const cached = cache.get<TestSeries[]>(cacheKey);
  if (cached) {
    console.log("[TestSeries DB] Test series loaded from cache");
    return cached;
  }

  try {
    // Try with orderBy first
    const qRef = query(testSeriesCollectionRef(), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(qRef);
    const testSeries: TestSeries[] = snapshot.docs.map((docSnap) => mapTestSeriesDoc(docSnap));
    
    // Cache for 5 minutes
    cache.set(cacheKey, testSeries, 5 * 60 * 1000);
    
    console.log("[TestSeries DB] listTestSeries loaded count:", testSeries.length);
    return testSeries;
  } catch (error) {
    // If orderBy fails (e.g., missing index), try without ordering
    if (error instanceof Error && error.message.includes("index")) {
      console.warn("[TestSeries DB] Index missing, fetching without orderBy");
      try {
        const snapshot = await getDocs(testSeriesCollectionRef());
        const testSeries: TestSeries[] = snapshot.docs.map((docSnap) => mapTestSeriesDoc(docSnap));
        // Sort manually by createdAt if available
        testSeries.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime; // Descending order
        });
        
        // Cache for 5 minutes
        cache.set(cacheKey, testSeries, 5 * 60 * 1000);
        
        console.log("[TestSeries DB] listTestSeries loaded count (fallback):", testSeries.length);
        return testSeries;
      } catch (fallbackError) {
        console.error("[TestSeries DB] Fallback also failed:", fallbackError);
        throw fallbackError;
      }
    }
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to list test series from Firestore");
    console.error("[TestSeries DB] Error listing test series:", dbError);
    throw dbError;
  }
}

/**
 * List test series with pagination support
 */
export interface PaginatedTestSeriesResult {
  testSeries: TestSeries[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  total?: number;
}

export async function listTestSeriesPaginated(
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedTestSeriesResult> {
  console.log("[TestSeries DB] listTestSeriesPaginated called", { page, pageSize });

  const cacheKey = cacheKeys.testSeries({ page, pageSize });
  const cached = cache.get<PaginatedTestSeriesResult>(cacheKey);
  if (cached) {
    console.log("[TestSeries DB] Test series loaded from cache");
    return cached;
  }

  try {
    const constraints: QueryConstraint[] = [
      orderBy("createdAt", "desc"),
      limit(pageSize + 1), // Fetch one extra to check if there's more
    ];

    const qRef = query(testSeriesCollectionRef(), ...constraints);
    const snapshot = await getDocs(qRef);
    const docs = snapshot.docs;

    const hasMore = docs.length > pageSize;
    const testSeriesToReturn = hasMore ? docs.slice(0, pageSize) : docs;
    const lastDoc = testSeriesToReturn.length > 0 ? testSeriesToReturn[testSeriesToReturn.length - 1] : null;

    const testSeries: TestSeries[] = testSeriesToReturn.map((docSnap) => mapTestSeriesDoc(docSnap));

    const result: PaginatedTestSeriesResult = {
      testSeries,
      lastDoc,
      hasMore,
    };

    // Cache for 5 minutes
    cache.set(cacheKey, result, 5 * 60 * 1000);

    console.log("[TestSeries DB] listTestSeriesPaginated loaded count:", testSeries.length, "hasMore:", hasMore);
    return result;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to list test series from Firestore");
    console.error("[TestSeries DB] Error listing test series:", dbError);
    throw dbError;
  }
}

export async function updateTestSeries(
  id: string,
  updates: Partial<TestSeriesInput>
): Promise<void> {
  console.log("[TestSeries DB] updateTestSeries called with:", { id, updates });
  if (!id || typeof id !== "string" || id.trim() === "") {
    throw new Error("TestSeries id is required and must be a non-empty string");
  }

  // Remove undefined values to avoid Firestore errors
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== undefined)
  ) as Partial<TestSeriesInput>;

  const testSeriesRef = doc(db, TEST_SERIES_COLLECTION, id);
  const updateData: Partial<Omit<TestSeriesDoc, "updatedAt">> & {
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    ...cleanUpdates,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(testSeriesRef, updateData);
    // Invalidate cache
    cache.invalidate(cacheKeys.testSeriesById(id));
    cache.invalidatePattern("^testSeries:");
    cache.invalidate(cacheKeys.publishedTestSeries());
    // Also invalidate enrollment caches since they include test series data
    // This ensures students see newly added tests immediately
    cache.invalidatePattern("^enrollments:");
    console.log("[TestSeries DB] TestSeries updated successfully");
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to update test series in Firestore");
    console.error("[TestSeries DB] Error updating test series:", dbError);
    throw dbError;
  }
}

export async function deleteTestSeries(id: string): Promise<void> {
  console.log("[TestSeries DB] deleteTestSeries called with id:", id);
  if (!id || typeof id !== "string" || id.trim() === "") {
    throw new Error("TestSeries id is required and must be a non-empty string");
  }

  const testSeriesRef = doc(db, TEST_SERIES_COLLECTION, id);
  try {
    await deleteDoc(testSeriesRef);
    // Invalidate cache
    cache.invalidate(cacheKeys.testSeriesById(id));
    cache.invalidatePattern("^testSeries:");
    cache.invalidate(cacheKeys.publishedTestSeries());
    console.log("[TestSeries DB] TestSeries deleted successfully");
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to delete test series from Firestore");
    console.error("[TestSeries DB] Error deleting test series:", dbError);
    throw dbError;
  }
}

export async function toggleTestSeriesPublishStatus(id: string, isPublished: boolean): Promise<void> {
  console.log("[TestSeries DB] toggleTestSeriesPublishStatus called with:", { id, isPublished });
  if (!id || typeof id !== "string" || id.trim() === "") {
    throw new Error("TestSeries id is required and must be a non-empty string");
  }

  const testSeriesRef = doc(db, TEST_SERIES_COLLECTION, id);
  const updateData = {
    isPublished: isPublished,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(testSeriesRef, updateData);
    // Invalidate cache
    cache.invalidate(cacheKeys.testSeriesById(id));
    cache.invalidatePattern("^testSeries:");
    cache.invalidate(cacheKeys.publishedTestSeries());
    console.log("[TestSeries DB] TestSeries publish status updated:", isPublished);
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to update test series publish status in Firestore");
    console.error("[TestSeries DB] Error updating publish status:", dbError);
    throw dbError;
  }
}

export async function listPublishedTestSeries(): Promise<TestSeries[]> {
  console.log("[TestSeries DB] listPublishedTestSeries called");
  
  // Check cache first
  const cacheKey = cacheKeys.publishedTestSeries();
  const cached = cache.get<TestSeries[]>(cacheKey);
  if (cached) {
    console.log("[TestSeries DB] Published test series loaded from cache");
    return cached;
  }

  try {
    // Try with orderBy and where clause
    const qRef = query(
      testSeriesCollectionRef(),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(qRef);
    // Filter published test series in memory
    const testSeries: TestSeries[] = snapshot.docs
      .map((docSnap) => mapTestSeriesDoc(docSnap))
      .filter((series) => series.isPublished === true);
    // Cache for 5 minutes
    cache.set(cacheKey, testSeries, 5 * 60 * 1000);
    console.log("[TestSeries DB] listPublishedTestSeries loaded count:", testSeries.length);
    return testSeries;
  } catch (error) {
    // If orderBy fails, try without ordering
    if (error instanceof Error && error.message.includes("index")) {
      console.warn("[TestSeries DB] Index missing, fetching without orderBy");
      try {
        const snapshot = await getDocs(testSeriesCollectionRef());
        const testSeries: TestSeries[] = snapshot.docs
          .map((docSnap) => mapTestSeriesDoc(docSnap))
          .filter((series) => series.isPublished === true);
        // Sort manually by createdAt if available
        testSeries.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime; // Descending order
        });
        console.log("[TestSeries DB] listPublishedTestSeries loaded count (fallback):", testSeries.length);
        return testSeries;
      } catch (fallbackError) {
        console.error("[TestSeries DB] Fallback also failed:", fallbackError);
        throw fallbackError;
      }
    }
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to list published test series from Firestore");
    console.error("[TestSeries DB] Error listing published test series:", dbError);
    throw dbError;
  }
}



