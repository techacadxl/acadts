// lib/types/question.ts
import type { Timestamp } from "firebase/firestore";

export type QuestionType = "mcq_single" | "mcq_multiple" | "numerical";

export type DifficultyLevel = "easy" | "medium" | "hard";

export interface QuestionDoc {
  // Core classification
  type: QuestionType;
  subject: string;              // e.g. "Physics"
  topic: string;                // e.g. "Kinematics"
  tags: string[];               // e.g. ["1D-motion", "JEE Main"]

  // Question content
  text: string;                 // question statement
  imageUrl?: string | null;     // URL to question image (optional)
  options?: string[];           // for MCQs (A, B, C, D, ...)
  correctOptions?: number[];    // indices for correct options (0-based)
  correctAnswer?: string | null; // for numerical / non-MCQ answers
  explanation?: string | null;

  // Scoring
  marks: number;                // + marks for correct answer
  penalty: number;              // negative marking (0 if none)
  difficulty: DifficultyLevel;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;            // admin UID
}

// Same as QuestionDoc but with Firestore document id included
export interface Question extends QuestionDoc {
  id: string;
}

// Input type for creating/updating a question from forms (before timestamps)
export interface QuestionInput {
  type: QuestionType;
  subject: string;
  topic: string;
  tags: string[];
  text: string;
  imageUrl?: string | null;
  options?: string[];
  correctOptions?: number[];
  correctAnswer?: string | null;
  explanation?: string | null;
  marks: number;
  penalty: number;
  difficulty: DifficultyLevel;
}
