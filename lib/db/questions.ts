// lib/db/questions.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type {
  Question,
  QuestionDoc,
  QuestionInput,
  DifficultyLevel,
  QuestionType,
} from "@/lib/types/question";
import { cache, cacheKeys } from "@/lib/utils/cache";

const QUESTIONS_COLLECTION = "questions";

function questionsCollectionRef() {
  return collection(db, QUESTIONS_COLLECTION);
}

/**
 * Maps a Firestore document snapshot to a Question object
 */
function mapQuestionDoc(
  snapshot: QueryDocumentSnapshot | DocumentSnapshot
): Question {
  const data = snapshot.data() as QuestionDoc;
  return {
    id: snapshot.id,
    ...data,
  };
}

/**
 * Create a new question document
 * @param input - Question data from form (no timestamps / createdBy)
 * @param adminUid - UID of the admin creating the question
 * @returns The newly created question document id
 */
export async function createQuestion(
  input: QuestionInput,
  adminUid: string
): Promise<string> {
  console.log("[Questions DB] createQuestion called with:", {
    input,
    adminUid,
  });

  if (!adminUid || typeof adminUid !== "string" || adminUid.trim() === "") {
    const error = new Error("adminUid is required and must be a non-empty string");
    console.error("[Questions DB] createQuestion error:", error);
    throw error;
  }

  // Remove undefined values to avoid Firestore errors
  const cleanInput = Object.fromEntries(
    Object.entries(input).filter(([_, value]) => value !== undefined)
  ) as QuestionInput;

  const docData: Omit<QuestionDoc, "createdAt" | "updatedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    ...cleanInput,
    explanation: cleanInput.explanation ?? null,
    correctAnswer: cleanInput.correctAnswer ?? null,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(questionsCollectionRef(), docData);
    // Invalidate questions cache
    cache.invalidatePattern("^questions:");
    console.log("[Questions DB] Question created with id:", docRef.id);
    return docRef.id;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to create question in Firestore");
    console.error("[Questions DB] Error creating question:", dbError);
    throw dbError;
  }
}

/**
 * Update an existing question document
 * @param id - Question document id
 * @param updates - Partial question input to update
 */
export async function updateQuestion(
  id: string,
  updates: Partial<QuestionInput>
): Promise<void> {
  console.log("[Questions DB] updateQuestion called with:", { id, updates });

  if (!id || typeof id !== "string" || id.trim() === "") {
    const error = new Error("Question id is required and must be a non-empty string");
    console.error("[Questions DB] updateQuestion error:", error);
    throw error;
  }

  const questionRef = doc(db, QUESTIONS_COLLECTION, id);

  const updateData: Partial<Omit<QuestionDoc, "updatedAt">> & {
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(questionRef, updateData);
    // Invalidate cache for this question and list
    cache.invalidate(cacheKeys.question(id));
    cache.invalidatePattern("^questions:");
    console.log("[Questions DB] Question updated successfully");
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to update question in Firestore");
    console.error("[Questions DB] Error updating question:", dbError);
    throw dbError;
  }
}

/**
 * Delete a question document
 * @param id - Question document id
 */
export async function deleteQuestion(id: string): Promise<void> {
  console.log("[Questions DB] deleteQuestion called with id:", id);

  if (!id || typeof id !== "string" || id.trim() === "") {
    const error = new Error("Question id is required and must be a non-empty string");
    console.error("[Questions DB] deleteQuestion error:", error);
    throw error;
  }

  const questionRef = doc(db, QUESTIONS_COLLECTION, id);

  try {
    await deleteDoc(questionRef);
    // Invalidate cache for this question and list
    cache.invalidate(cacheKeys.question(id));
    cache.invalidatePattern("^questions:");
    console.log("[Questions DB] Question deleted successfully");
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to delete question from Firestore");
    console.error("[Questions DB] Error deleting question:", dbError);
    throw dbError;
  }
}

/**
 * Get a single question by id
 * @param id - Question document id
 */
export async function getQuestionById(id: string): Promise<Question | null> {
  console.log("[Questions DB] getQuestionById called with id:", id);

  if (!id || typeof id !== "string" || id.trim() === "") {
    const error = new Error("Question id is required and must be a non-empty string");
    console.error("[Questions DB] getQuestionById error:", error);
    throw error;
  }

  // Check cache first
  const cacheKey = cacheKeys.question(id);
  const cached = cache.get<Question>(cacheKey);
  if (cached) {
    console.log("[Questions DB] Question loaded from cache:", id);
    return cached;
  }

  const questionRef = doc(db, QUESTIONS_COLLECTION, id);

  try {
    const snap = await getDoc(questionRef);
    if (!snap.exists()) {
      console.warn("[Questions DB] Question not found for id:", id);
      return null;
    }

    const question = mapQuestionDoc(snap);
    // Cache for 10 minutes
    cache.set(cacheKey, question, 10 * 60 * 1000);
    console.log("[Questions DB] Question loaded:", { id: question.id });
    return question;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to fetch question from Firestore");
    console.error("[Questions DB] Error fetching question:", dbError);
    throw dbError;
  }
}

export interface ListQuestionsParams {
  subject?: string;
  chapter?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: DifficultyLevel;
  type?: QuestionType;
  limit?: number;
  lastDoc?: QueryDocumentSnapshot;
}

export interface PaginatedQuestionsResult {
  questions: Question[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * List questions with optional filters and pagination
 */
export async function listQuestions(
  params: ListQuestionsParams = {}
): Promise<Question[]> {
  const result = await listQuestionsPaginated(params);
  return result.questions;
}

/**
 * List questions with pagination support
 */
export async function listQuestionsPaginated(
  params: ListQuestionsParams = {}
): Promise<PaginatedQuestionsResult> {
  console.log("[Questions DB] listQuestionsPaginated called with params:", params);

  // If no limit specified, fetch all questions (for admin pages)
  // Otherwise use the specified limit or default to 50 for pagination
  const usePagination = params.limit !== undefined;
  const pageLimit = params.limit || 50;
  const cacheKey = cacheKeys.questions(params);

  // Check cache (only for first page without pagination cursor)
  if (!params.lastDoc) {
    const cached = cache.get<PaginatedQuestionsResult>(cacheKey);
    if (cached) {
      console.log("[Questions DB] Questions loaded from cache");
      return cached;
    }
  }

  try {
    const constraints: QueryConstraint[] = [];
    const hasFilters = !!(params.subject || params.chapter || params.topic || params.subtopic || params.difficulty || params.type);

    if (params.subject) {
      constraints.push(where("subject", "==", params.subject));
    }
    if (params.chapter) {
      constraints.push(where("chapter", "==", params.chapter));
    }
    if (params.topic) {
      constraints.push(where("topic", "==", params.topic));
    }
    if (params.subtopic) {
      constraints.push(where("subtopic", "==", params.subtopic));
    }
    if (params.difficulty) {
      constraints.push(where("difficulty", "==", params.difficulty));
    }
    if (params.type) {
      constraints.push(where("type", "==", params.type));
    }

    // Add pagination only if limit is specified
    if (usePagination) {
      constraints.push(limit(pageLimit + 1)); // Fetch one extra to check if there's more
      if (params.lastDoc) {
        constraints.push(startAfter(params.lastDoc));
      }
    }

    // Only use orderBy when there are no filters to avoid composite index requirement
    let qRef;
    if (hasFilters) {
      // No orderBy when filters are present - sort client-side instead
      qRef = query(questionsCollectionRef(), ...constraints);
    } else {
      // Use orderBy only when no filters (no composite index needed)
      constraints.unshift(orderBy("createdAt", "desc"));
      qRef = query(questionsCollectionRef(), ...constraints);
    }

    const snapshot = await getDocs(qRef);
    const docs = snapshot.docs;
    
    let hasMore = false;
    let questionsToReturn = docs;
    let lastDoc: QueryDocumentSnapshot | null = null;
    
    if (usePagination) {
      hasMore = docs.length > pageLimit;
      questionsToReturn = hasMore ? docs.slice(0, pageLimit) : docs;
      lastDoc = questionsToReturn.length > 0 ? questionsToReturn[questionsToReturn.length - 1] : null;
    } else {
      // No pagination - return all questions
      lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
      hasMore = false;
    }

    let questions: Question[] = questionsToReturn.map((docSnap) =>
      mapQuestionDoc(docSnap)
    );

    // Sort client-side when filters are applied
    if (hasFilters) {
      questions = questions.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime; // newest first
      });
    }

    const result: PaginatedQuestionsResult = {
      questions,
      lastDoc: lastDoc as QueryDocumentSnapshot | null,
      hasMore,
    };

    // Cache first page only (no lastDoc)
    if (!params.lastDoc) {
      cache.set(cacheKey, result, 10 * 60 * 1000); // 10 minutes (increased for better performance)
    }

    console.log("[Questions DB] listQuestionsPaginated loaded count:", questions.length, "hasMore:", hasMore);
    return result;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to list questions from Firestore");
    console.error("[Questions DB] Error listing questions:", dbError);
    throw dbError;
  }
}
