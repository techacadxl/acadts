// lib/db/questions.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type {
  Question,
  QuestionDoc,
  QuestionInput,
  DifficultyLevel,
  QuestionType,
} from "@/lib/types/question";

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

  const docData: Omit<QuestionDoc, "createdAt" | "updatedAt"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    ...input,
    explanation: input.explanation ?? null,
    correctAnswer: input.correctAnswer ?? null,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(questionsCollectionRef(), docData);
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

  const questionRef = doc(db, QUESTIONS_COLLECTION, id);

  try {
    const snap = await getDoc(questionRef);
    if (!snap.exists()) {
      console.warn("[Questions DB] Question not found for id:", id);
      return null;
    }

    const question = mapQuestionDoc(snap);
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
}

/**
 * List questions with optional filters
 */
export async function listQuestions(
  params: ListQuestionsParams = {}
): Promise<Question[]> {
  console.log("[Questions DB] listQuestions called with params:", params);

  try {
    const constraints = [];
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

    // Only use orderBy when there are no filters to avoid composite index requirement
    // When filters are applied, we'll sort client-side
    let qRef;
    if (hasFilters) {
      // No orderBy when filters are present - sort client-side instead
      qRef = query(questionsCollectionRef(), ...constraints);
    } else {
      // Use orderBy only when no filters (no composite index needed)
      const baseConstraints = [orderBy("createdAt", "desc")];
      qRef = query(questionsCollectionRef(), ...baseConstraints);
    }

    const snapshot = await getDocs(qRef);
    let questions: Question[] = snapshot.docs.map((docSnap) =>
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

    console.log("[Questions DB] listQuestions loaded count:", questions.length);
    return questions;
  } catch (error) {
    const dbError =
      error instanceof Error
        ? error
        : new Error("Failed to list questions from Firestore");
    console.error("[Questions DB] Error listing questions:", dbError);
    throw dbError;
  }
}
