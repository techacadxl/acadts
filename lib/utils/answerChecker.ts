// lib/utils/answerChecker.ts
import type { Question } from "@/lib/types/question";
import type { QuestionResponse } from "@/lib/types/testResult";

/**
 * Check if a numerical answer is correct (with tolerance for floating point)
 * @param studentAnswer - Student's answer as string
 * @param correctAnswer - Correct answer as string
 * @param tolerance - Tolerance for numerical comparison (default: 0.0001)
 * @returns true if answer is correct
 */
function checkNumericalAnswer(
  studentAnswer: string,
  correctAnswer: string,
  tolerance: number = 0.0001
): boolean {
  try {
    const studentNum = parseFloat(studentAnswer.trim());
    const correctNum = parseFloat(correctAnswer.trim());
    
    if (isNaN(studentNum) || isNaN(correctNum)) {
      // If parsing fails, do string comparison (case-insensitive, trimmed)
      return studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    }
    
    // Compare with tolerance
    return Math.abs(studentNum - correctNum) <= tolerance;
  } catch {
    // Fallback to string comparison
    return studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  }
}

/**
 * Check if MCQ single answer is correct
 * @param studentAnswer - Student's selected option index
 * @param correctOptions - Array of correct option indices
 * @returns true if answer is correct
 */
function checkMCQSingleAnswer(
  studentAnswer: number,
  correctOptions: number[]
): boolean {
  if (correctOptions.length === 0) return false;
  return correctOptions[0] === studentAnswer;
}

/**
 * Check if MCQ multiple answer is correct
 * @param studentAnswer - Student's selected option indices
 * @param correctOptions - Array of correct option indices
 * @returns true if answer is correct
 */
function checkMCQMultipleAnswer(
  studentAnswer: number[],
  correctOptions: number[]
): boolean {
  if (correctOptions.length === 0) return studentAnswer.length === 0;
  if (studentAnswer.length !== correctOptions.length) return false;
  
  // Sort both arrays and compare
  const sortedStudent = [...studentAnswer].sort((a, b) => a - b);
  const sortedCorrect = [...correctOptions].sort((a, b) => a - b);
  
  return sortedStudent.every((val, idx) => val === sortedCorrect[idx]);
}

/**
 * Check if a student's answer is correct
 * @param question - Question object with correct answer information
 * @param studentAnswer - Student's answer (number for MCQ single, number[] for MCQ multiple, string for numerical)
 * @returns true if answer is correct, false otherwise
 */
export function checkAnswer(
  question: Question,
  studentAnswer: number | number[] | string | null
): boolean {
  if (studentAnswer === null || studentAnswer === undefined) {
    return false;
  }

  switch (question.type) {
    case "mcq_single":
      if (typeof studentAnswer !== "number") return false;
      if (!question.correctOptions || question.correctOptions.length === 0) return false;
      return checkMCQSingleAnswer(studentAnswer, question.correctOptions);

    case "mcq_multiple":
      if (!Array.isArray(studentAnswer)) return false;
      if (!question.correctOptions || question.correctOptions.length === 0) {
        return studentAnswer.length === 0;
      }
      return checkMCQMultipleAnswer(studentAnswer, question.correctOptions);

    case "numerical":
      if (typeof studentAnswer !== "string") return false;
      if (!question.correctAnswer) return false;
      return checkNumericalAnswer(studentAnswer, question.correctAnswer);

    default:
      return false;
  }
}

/**
 * Calculate marks obtained for a question
 * @param isCorrect - Whether the answer is correct
 * @param marks - Positive marks for correct answer
 * @param negativeMarks - Negative marks for incorrect answer
 * @returns Marks obtained (positive if correct, negative if incorrect, 0 if not answered)
 */
export function calculateMarks(
  isCorrect: boolean,
  marks: number,
  negativeMarks: number
): number {
  if (isCorrect) {
    return marks;
  } else {
    return -negativeMarks; // Negative marking for incorrect answer
  }
}

/**
 * Process all answers and create question responses
 * @param questions - Array of questions with test data
 * @param answers - Map of question index to student answer
 * @returns Array of question responses with checking results
 */
export function processAnswers(
  questions: Array<Question & { testMarks: number; testNegativeMarks: number; sectionId: string; subsectionId: string; order: number }>,
  answers: Map<number, number | number[] | string>
): QuestionResponse[] {
  return questions.map((question, index) => {
    const studentAnswer = answers.get(index) ?? null;
    const isCorrect = checkAnswer(question, studentAnswer);
    
    // Get correct answer for display
    let correctAnswer: number[] | string | null = null;
    if (question.type === "numerical") {
      correctAnswer = question.correctAnswer ?? null;
    } else {
      correctAnswer = question.correctOptions ?? null;
    }
    
    const marksObtained = studentAnswer !== null
      ? calculateMarks(isCorrect, question.testMarks, question.testNegativeMarks)
      : 0;

    return {
      questionId: question.id,
      questionIndex: index,
      studentAnswer,
      correctAnswer,
      isCorrect,
      marksObtained,
      sectionId: question.sectionId,
      subsectionId: question.subsectionId,
    };
  });
}






