// app/dashboard/tests/[id]/result/[resultId]/page.tsx
"use client";

import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useEffect, useState, useMemo } from "react";
import { getTestResultById } from "@/lib/db/testResults";
import { getTestById } from "@/lib/db/tests";
import { getQuestionById } from "@/lib/db/questions";
import type { TestResult } from "@/lib/types/testResult";
import type { Test } from "@/lib/types/test";
import type { Question } from "@/lib/types/question";

interface QuestionWithResult extends Question {
  result: {
    studentAnswer: number | number[] | string | null;
    correctAnswer: number[] | string | null;
    isCorrect: boolean;
    marksObtained: number;
  };
}

export default function TestResultPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const testId = params?.id as string;
  const resultId = params?.resultId as string;

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<QuestionWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load test result and questions
  useEffect(() => {
    if (authLoading || profileLoading || !testId || !resultId) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role === "admin") {
      router.replace("/admin");
      return;
    }

    const loadResultData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load test result
        const result = await getTestResultById(resultId);
        if (!result) {
          setError("Test result not found.");
          setLoading(false);
          return;
        }

        // Verify this result belongs to the current user
        if (result.userId !== user.uid) {
          setError("You don't have permission to view this result.");
          setLoading(false);
          return;
        }

        // Verify test ID matches
        if (result.testId !== testId) {
          setError("Test result does not match the test.");
          setLoading(false);
          return;
        }

        setTestResult(result);

        // Load test
        const testData = await getTestById(testId);
        if (!testData) {
          setError("Test not found.");
          setLoading(false);
          return;
        }
        setTest(testData);

        // Load questions with results
        const questionPromises = result.responses.map(async (response) => {
          const question = await getQuestionById(response.questionId);
          if (!question) return null;

          return {
            ...question,
            result: {
              studentAnswer: response.studentAnswer,
              correctAnswer: response.correctAnswer,
              isCorrect: response.isCorrect,
              marksObtained: response.marksObtained,
            },
          } as QuestionWithResult;
        });

        const loadedQuestions = await Promise.all(questionPromises);
        const validQuestions = loadedQuestions.filter(
          (q): q is QuestionWithResult => q !== null
        );

        // Sort by question index
        validQuestions.sort((a, b) => {
          const aIndex = result.responses.find((r) => r.questionId === a.id)?.questionIndex ?? 0;
          const bIndex = result.responses.find((r) => r.questionId === b.id)?.questionIndex ?? 0;
          return aIndex - bIndex;
        });

        setQuestions(validQuestions);
      } catch (err) {
        console.error("[TestResultPage] Error loading result:", err);
        setError(err instanceof Error ? err.message : "Failed to load test result.");
      } finally {
        setLoading(false);
      }
    };

    loadResultData();
  }, [authLoading, profileLoading, user, role, testId, resultId, router]);

  // Format time
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Format answer for display
  const formatAnswer = (answer: number | number[] | string | null, questionType: string): string => {
    if (answer === null) return "Not answered";
    
    if (questionType === "numerical") {
      return String(answer);
    }
    
    if (Array.isArray(answer)) {
      return answer.map((idx) => String.fromCharCode(65 + idx)).join(", ");
    }
    
    return String.fromCharCode(65 + (answer as number));
  };

  // Format correct answer for display
  const formatCorrectAnswer = (answer: number[] | string | null, questionType: string): string => {
    if (answer === null) return "N/A";
    
    if (questionType === "numerical") {
      return String(answer);
    }
    
    if (Array.isArray(answer)) {
      return answer.map((idx) => String.fromCharCode(65 + idx)).join(", ");
    }
    
    return String.fromCharCode(65 + answer);
  };

  // Calculate percentage
  const percentage = useMemo(() => {
    if (!testResult || testResult.totalMarksPossible === 0) return 0;
    return (testResult.totalMarksObtained / testResult.totalMarksPossible) * 100;
  }, [testResult]);

  // Loading state
  if (authLoading || profileLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Loading results...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error || !testResult || !test) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-gray-600 mb-4">{error || "Failed to load test result."}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{test.title}</h1>
          <p className="text-gray-600 mb-4">{test.description}</p>
          
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Total Marks</div>
              <div className="text-2xl font-bold text-blue-700">
                {testResult.totalMarksObtained.toFixed(2)} / {testResult.totalMarksPossible.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}%</div>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Correct</div>
              <div className="text-2xl font-bold text-green-700">{testResult.correctAnswers}</div>
              <div className="text-xs text-gray-500 mt-1">out of {testResult.totalQuestions}</div>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Incorrect</div>
              <div className="text-2xl font-bold text-red-700">{testResult.incorrectAnswers}</div>
              <div className="text-xs text-gray-500 mt-1">out of {testResult.answeredQuestions}</div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Not Answered</div>
              <div className="text-2xl font-bold text-gray-700">{testResult.notAnswered}</div>
              <div className="text-xs text-gray-500 mt-1">Time: {formatTime(testResult.timeSpentSeconds)}</div>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Question-wise Results</h2>
          
          <div className="space-y-6">
            {questions.map((question, index) => {
              const isCorrect = question.result.isCorrect;
              const hasAnswer = question.result.studentAnswer !== null;
              
              return (
                <div
                  key={question.id}
                  className={`border rounded-lg p-4 ${
                    isCorrect ? "border-green-300 bg-green-50" : hasAnswer ? "border-red-300 bg-red-50" : "border-gray-300 bg-gray-50"
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-900">Q{index + 1}</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        isCorrect
                          ? "bg-green-200 text-green-800"
                          : hasAnswer
                          ? "bg-red-200 text-red-800"
                          : "bg-gray-200 text-gray-800"
                      }`}>
                        {isCorrect ? "Correct" : hasAnswer ? "Incorrect" : "Not Answered"}
                      </span>
                      <span className="text-sm text-gray-600">
                        Marks: <span className="font-semibold">{question.result.marksObtained.toFixed(2)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div className="mb-4">
                    <div
                      className="prose prose-sm max-w-none text-gray-900 question-content"
                      dangerouslySetInnerHTML={{ __html: question.text }}
                    />
                  </div>

                  {/* Question Image */}
                  {question.imageUrl && (
                    <div className="mb-4">
                      <img
                        src={question.imageUrl}
                        alt="Question"
                        className="max-w-full h-auto rounded"
                      />
                    </div>
                  )}

                  {/* Options (for MCQ) */}
                  {question.type !== "numerical" && question.options && (
                    <div className="mb-4">
                      <div className="space-y-2">
                        {question.options.map((option, optIndex) => {
                          const optionLabel = String.fromCharCode(65 + optIndex);
                          const isSelected = question.type === "mcq_single"
                            ? question.result.studentAnswer === optIndex
                            : Array.isArray(question.result.studentAnswer) && question.result.studentAnswer.includes(optIndex);
                          const isCorrectOption = Array.isArray(question.result.correctAnswer)
                            ? question.result.correctAnswer.includes(optIndex)
                            : false;
                          
                          return (
                            <div
                              key={optIndex}
                              className={`p-2 rounded ${
                                isCorrectOption
                                  ? "bg-green-100 border-2 border-green-500"
                                  : isSelected
                                  ? "bg-red-100 border-2 border-red-500"
                                  : "bg-gray-50 border border-gray-200"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <span className="font-medium text-gray-700 min-w-[20px]">
                                  {optionLabel}.
                                </span>
                                <div
                                  className="prose prose-sm max-w-none text-gray-900 question-content flex-1"
                                  dangerouslySetInnerHTML={{ __html: option }}
                                />
                                {isCorrectOption && (
                                  <span className="text-green-700 font-semibold text-xs">✓ Correct</span>
                                )}
                                {isSelected && !isCorrectOption && (
                                  <span className="text-red-700 font-semibold text-xs">✗ Your Answer</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Answer Summary (for Numerical) */}
                  {question.type === "numerical" && (
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-sm font-semibold text-gray-700">Your Answer: </span>
                          <span className={`text-sm font-bold ${
                            isCorrect ? "text-green-700" : hasAnswer ? "text-red-700" : "text-gray-500"
                          }`}>
                            {formatAnswer(question.result.studentAnswer, question.type)}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-gray-700">Correct Answer: </span>
                          <span className="text-sm font-bold text-green-700">
                            {formatCorrectAnswer(question.result.correctAnswer, question.type)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  {question.explanation && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="text-sm font-semibold text-blue-900 mb-1">Explanation:</div>
                      <div
                        className="prose prose-sm max-w-none text-blue-800 question-content"
                        dangerouslySetInnerHTML={{ __html: question.explanation }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4 justify-center">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </main>
  );
}

