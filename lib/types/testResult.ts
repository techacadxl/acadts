// lib/types/testResult.ts
import type { Timestamp } from "firebase/firestore";

/**
 * Individual question response and result
 */
export interface QuestionResponse {
  questionId: string;
  questionIndex: number; // 0-based index in the test
  studentAnswer: number | number[] | string | null; // null if not answered
  correctAnswer: number[] | string | null; // correct options (for MCQ) or correct answer (for numerical)
  isCorrect: boolean;
  marksObtained: number; // positive marks if correct, negative if incorrect, 0 if not answered
  sectionId: string;
  subsectionId: string;
}

/**
 * Test result document in Firestore
 */
export interface TestResultDoc {
  testId: string;
  userId: string;
  userName?: string; // User's name for easy reference
  userEmail?: string; // User's email for easy reference
  
  // Responses
  responses: QuestionResponse[];
  
  // Summary statistics
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  notAnswered: number;
  totalMarksObtained: number;
  totalMarksPossible: number; // Sum of all question marks in the test
  
  // Test metadata
  testTitle: string;
  testDurationMinutes: number;
  timeSpentSeconds: number; // Actual time spent on the test
  
  // Submission metadata
  submittedAt: Timestamp;
  startedAt?: Timestamp; // When the test was started
}

/**
 * Test result with document ID included
 */
export interface TestResult extends TestResultDoc {
  id: string;
}

/**
 * Input type for creating a test result (before timestamps)
 */
export interface TestResultInput {
  testId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  responses: QuestionResponse[];
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  notAnswered: number;
  totalMarksObtained: number;
  totalMarksPossible: number;
  testTitle: string;
  testDurationMinutes: number;
  timeSpentSeconds: number;
  startedAt?: Timestamp;
}

