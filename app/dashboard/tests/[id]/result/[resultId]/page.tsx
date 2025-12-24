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
import DescriptionRenderer from "@/components/DescriptionRenderer";

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
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [subjects, setSubjects] = useState<string[]>([]);

  // Load test result and questions
  useEffect(() => {
    if (authLoading || profileLoading || !testId || !resultId) return;

    if (!user) {
      router.replace("/login");
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

        // Verify this result belongs to the current user (unless admin)
        if (role !== "admin" && result.userId !== user.uid) {
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

        // Extract unique subjects
        const uniqueSubjects = Array.from(new Set(validQuestions.map(q => q.subject))).sort();
        setSubjects(uniqueSubjects);
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

  // Filter questions by selected subject
  const filteredQuestions = useMemo(() => {
    if (selectedSubject === "all") return questions;
    return questions.filter(q => q.subject === selectedSubject);
  }, [questions, selectedSubject]);

  // Calculate subject-wise statistics
  const subjectStats = useMemo(() => {
    if (selectedSubject === "all") return null;

    const subjectQuestions = questions.filter(q => q.subject === selectedSubject);
    const correct = subjectQuestions.filter(q => q.result.isCorrect).length;
    const incorrect = subjectQuestions.filter(q => q.result.studentAnswer !== null && !q.result.isCorrect).length;
    const unanswered = subjectQuestions.filter(q => q.result.studentAnswer === null).length;
    const total = subjectQuestions.length;
    const marksObtained = subjectQuestions.reduce((sum, q) => sum + q.result.marksObtained, 0);
    // Calculate possible marks from test questions
    const marksPossible = subjectQuestions.reduce((sum, q) => {
      const testQuestion = test?.questions.find(tq => tq.questionId === q.id);
      if (!testQuestion) return sum;
      // For possible marks, we need to consider the positive marks only
      // Since marksObtained can be negative, we calculate possible as the positive marks value
      return sum + testQuestion.marks;
    }, 0);

    return {
      total,
      correct,
      incorrect,
      unanswered,
      marksObtained,
      marksPossible,
      percentage: marksPossible > 0 ? (marksObtained / marksPossible) * 100 : 0,
    };
  }, [selectedSubject, questions, testResult, test]);

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
              onClick={() => router.push(role === "admin" ? "/admin" : "/dashboard")}
              className="px-4 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all"
            >
              {role === "admin" ? "Back to Admin Panel" : "Back to Dashboard"}
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
          <div className="text-gray-600 mb-4">
            <DescriptionRenderer description={test.description || ""} />
          </div>
          
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

        {/* Subject Filter and Analysis (Admin Only) */}
        {role === "admin" && subjects.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <h2 className="text-xl font-bold text-gray-900">Subject Analysis</h2>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Filter by Subject:</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject-wise Statistics */}
            {selectedSubject !== "all" && subjectStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-center">
                  <div className="text-xs font-medium text-blue-700 mb-1">Total Questions</div>
                  <div className="text-2xl font-bold text-blue-900">{subjectStats.total}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium text-green-700 mb-1">Correct</div>
                  <div className="text-2xl font-bold text-green-700">{subjectStats.correct}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium text-red-700 mb-1">Incorrect</div>
                  <div className="text-2xl font-bold text-red-700">{subjectStats.incorrect}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-700 mb-1">Not Answered</div>
                  <div className="text-2xl font-bold text-gray-700">{subjectStats.unanswered}</div>
                </div>
                <div className="col-span-2 md:col-span-4 mt-2 pt-4 border-t border-blue-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-blue-700 mb-1">Marks</div>
                      <div className="text-lg font-bold text-blue-900">
                        {subjectStats.marksObtained.toFixed(2)} / {subjectStats.marksPossible.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-blue-700 mb-1">Score</div>
                      <div className="text-lg font-bold text-blue-900">
                        {subjectStats.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* All Subjects Overview */}
            {selectedSubject === "all" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {subjects.map((subject) => {
                  const subjectQuestions = questions.filter(q => q.subject === subject);
                  const correct = subjectQuestions.filter(q => q.result.isCorrect).length;
                  const incorrect = subjectQuestions.filter(q => q.result.studentAnswer !== null && !q.result.isCorrect).length;
                  const unanswered = subjectQuestions.filter(q => q.result.studentAnswer === null).length;
                  const total = subjectQuestions.length;

                  return (
                    <div
                      key={subject}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer"
                      onClick={() => setSelectedSubject(subject)}
                    >
                      <div className="font-semibold text-gray-900 mb-3">{subject}</div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">Total</div>
                          <div className="font-bold text-gray-900">{total}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-green-600 mb-1">Correct</div>
                          <div className="font-bold text-green-700">{correct}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-red-600 mb-1">Wrong</div>
                          <div className="font-bold text-red-700">{incorrect}</div>
                        </div>
                        <div className="col-span-3 text-center pt-2 border-t border-gray-300">
                          <div className="text-xs text-gray-600 mb-1">Not Answered</div>
                          <div className="font-bold text-gray-700">{unanswered}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Questions List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {role === "admin" && selectedSubject !== "all" 
                ? `Questions - ${selectedSubject}` 
                : "Question-wise Results"}
            </h2>
            {role === "admin" && selectedSubject !== "all" && (
              <button
                onClick={() => setSelectedSubject("all")}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Show All Questions
              </button>
            )}
          </div>
          
          <div className="space-y-6">
            {filteredQuestions.map((question, index) => {
              // Calculate actual index - use original question index from test result
              const response = testResult?.responses.find(r => r.questionId === question.id);
              const actualIndex = response?.questionIndex !== undefined ? response.questionIndex + 1 : index + 1;
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
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-lg font-bold text-gray-900">Q{actualIndex}</span>
                      {role === "admin" && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          {question.subject}
                        </span>
                      )}
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
          {role === "admin" ? (
            <button
              onClick={() => router.push("/admin")}
              className="px-6 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all"
            >
              Back to Admin Panel
            </button>
          ) : (
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </div>
    </main>
  );
}




