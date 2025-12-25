// app/dashboard/tests/[id]/page.tsx
"use client";

import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { getTestById } from "@/lib/db/tests";
import { getQuestionById } from "@/lib/db/questions";
import { createTestResult, getUserTestResult } from "@/lib/db/testResults";
import { processAnswers } from "@/lib/utils/answerChecker";
import type { Test } from "@/lib/types/test";
import type { Question } from "@/lib/types/question";
import type { TestQuestion } from "@/lib/types/test";
import { Timestamp } from "firebase/firestore";
import RichTextRenderer from "@/components/RichTextRenderer";

interface QuestionWithTestData extends Question {
  testMarks: number;
  testNegativeMarks: number;
  order: number;
  sectionId: string;
  subsectionId: string;
}

type QuestionStatus = "not_visited" | "not_answered" | "answered" | "marked_for_review" | "answered_and_marked";

export default function TestTakingPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const testId = params?.id as string;

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<QuestionWithTestData[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questionStatuses, setQuestionStatuses] = useState<Map<number, QuestionStatus>>(new Map());
  const [answers, setAnswers] = useState<Map<number, number | number[] | string>>(new Map());
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const handleSubmitTestRef = useRef<((skipConfirm?: boolean) => Promise<void>) | null>(null);

  // Load test and questions
  useEffect(() => {
    if (authLoading || profileLoading || !testId) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role === "admin") {
      router.replace("/admin");
      return;
    }

    const loadTestData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Check if user has already attempted this test
        const existingResult = await getUserTestResult(user.uid, testId);
        if (existingResult) {
          setError("You have already attempted this test. Redirecting to results...");
          // Redirect to results page after a short delay
          setTimeout(() => {
            router.push(`/dashboard/tests/${testId}/result/${existingResult.id}`);
          }, 2000);
          setLoading(false);
          return;
        }

        const testData = await getTestById(testId);
        if (!testData) {
          setError("Test not found.");
          setLoading(false);
          return;
        }

        setTest(testData);

        if (!testData.questions || testData.questions.length === 0) {
          setError("This test has no questions.");
          setLoading(false);
          return;
        }

        const sortedTestQuestions = [...testData.questions].sort(
          (a, b) => a.order - b.order
        );

        const questionPromises = sortedTestQuestions.map(async (testQ: TestQuestion) => {
          const question = await getQuestionById(testQ.questionId);
          if (!question) return null;

          return {
            ...question,
            testMarks: testQ.marks,
            testNegativeMarks: testQ.negativeMarks,
            order: testQ.order,
            sectionId: testQ.sectionId || "",
            subsectionId: testQ.subsectionId || "",
          } as QuestionWithTestData;
        });

        const loadedQuestions = await Promise.all(questionPromises);
        const validQuestions = loadedQuestions.filter(
          (q): q is QuestionWithTestData => q !== null
        );

        if (validQuestions.length === 0) {
          setError("No valid questions found in this test.");
          setLoading(false);
          return;
        }

        setQuestions(validQuestions);
        setCurrentQuestionIndex(0);
        
        // Record start time
        startTimeRef.current = new Date();
        
        const initialStatuses = new Map<number, QuestionStatus>();
        validQuestions.forEach((_, index) => {
          initialStatuses.set(index, index === 0 ? "not_answered" : "not_visited");
        });
        setQuestionStatuses(initialStatuses);
      } catch (err) {
        console.error("[TestTakingPage] Error loading test:", err);
        setError(err instanceof Error ? err.message : "Failed to load test.");
      } finally {
        setLoading(false);
      }
    };

    loadTestData();
  }, [authLoading, profileLoading, user, role, testId, router]);

  // Get current section and subsection
  const currentSectionInfo = useMemo(() => {
    if (!test || !test.sections || questions.length === 0) return null;
    
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return null;
    
    const section = test.sections.find((s) => s.id === currentQ.sectionId);
    if (!section) return null;
    
    const subsection = section.subsections.find((sub) => sub.id === currentQ.subsectionId);
    if (!subsection) return null;
    
    return { section, subsection };
  }, [test, questions, currentQuestionIndex]);

  // Get question status
  const getQuestionStatus = useCallback((index: number): QuestionStatus => {
    return questionStatuses.get(index) || "not_visited";
  }, [questionStatuses]);

  // Update question status
  const updateQuestionStatus = useCallback((index: number, status: QuestionStatus) => {
    setQuestionStatuses((prev) => {
      const newMap = new Map(prev);
      newMap.set(index, status);
      return newMap;
    });
  }, []);

  // Handle answer selection
  const handleAnswerSelect = useCallback((index: number, answer: number | number[] | string) => {
    setAnswers((prev) => {
      const newMap = new Map(prev);
      newMap.set(index, answer);
      return newMap;
    });
    
    const isMarked = markedForReview.has(index);
    updateQuestionStatus(index, isMarked ? "answered_and_marked" : "answered");
  }, [markedForReview, updateQuestionStatus]);

  // Handle mark for review
  const handleMarkForReview = useCallback(() => {
    const currentStatus = getQuestionStatus(currentQuestionIndex);
    setMarkedForReview((prev) => {
      const newSet = new Set(prev);
      if (currentStatus === "marked_for_review" || currentStatus === "answered_and_marked") {
        newSet.delete(currentQuestionIndex);
        updateQuestionStatus(
          currentQuestionIndex,
          answers.has(currentQuestionIndex) ? "answered" : "not_answered"
        );
      } else {
        newSet.add(currentQuestionIndex);
        updateQuestionStatus(
          currentQuestionIndex,
          answers.has(currentQuestionIndex) ? "answered_and_marked" : "marked_for_review"
        );
      }
      return newSet;
    });
  }, [currentQuestionIndex, getQuestionStatus, answers, updateQuestionStatus]);

  // Handle clear response
  const handleClearResponse = useCallback(() => {
    setAnswers((prev) => {
      const newMap = new Map(prev);
      newMap.delete(currentQuestionIndex);
      return newMap;
    });
    
    const isMarked = markedForReview.has(currentQuestionIndex);
    updateQuestionStatus(
      currentQuestionIndex,
      isMarked ? "marked_for_review" : "not_answered"
    );
  }, [currentQuestionIndex, markedForReview, updateQuestionStatus]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      const status = getQuestionStatus(currentQuestionIndex + 1);
      if (status === "not_visited") {
        updateQuestionStatus(currentQuestionIndex + 1, "not_answered");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentQuestionIndex, questions.length, getQuestionStatus, updateQuestionStatus]);

  const handleSaveAndNext = useCallback(() => {
    const hasAnswer = answers.has(currentQuestionIndex);
    const isMarked = markedForReview.has(currentQuestionIndex);
    const currentStatus = getQuestionStatus(currentQuestionIndex);
    
    if (currentStatus === "not_visited" || (!hasAnswer && currentStatus !== "marked_for_review")) {
      updateQuestionStatus(
        currentQuestionIndex,
        isMarked ? "marked_for_review" : "not_answered"
      );
    }
    
    handleNext();
  }, [currentQuestionIndex, getQuestionStatus, updateQuestionStatus, handleNext, answers, markedForReview]);

  const handleMarkForReviewAndNext = useCallback(() => {
    handleMarkForReview();
    handleNext();
  }, [handleMarkForReview, handleNext]);

  const handleGoToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
      const status = getQuestionStatus(index);
      if (status === "not_visited") {
        updateQuestionStatus(index, "not_answered");
      }
      // Close sidebar on mobile after selecting a question
      setIsSidebarOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [questions.length, getQuestionStatus, updateQuestionStatus]);

  const handleGoToSection = useCallback((sectionId: string) => {
    const firstQuestionInSection = questions.findIndex(
      (q) => q.sectionId === sectionId
    );
    if (firstQuestionInSection >= 0) {
      handleGoToQuestion(firstQuestionInSection);
    }
  }, [questions, handleGoToQuestion]);

  const handleGoToSubsection = useCallback((sectionId: string, subsectionId: string) => {
    const firstQuestionInSubsection = questions.findIndex(
      (q) => q.sectionId === sectionId && q.subsectionId === subsectionId
    );
    if (firstQuestionInSubsection >= 0) {
      handleGoToQuestion(firstQuestionInSubsection);
    }
  }, [questions, handleGoToQuestion]);

  // Format time
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, []);

  // Handle test submission
  const handleSubmitTest = useCallback(async (skipConfirm: boolean = false) => {
    if (!test || !user || questions.length === 0) return;
    
    if (!skipConfirm) {
      const confirmed = window.confirm(
        "Are you sure you want to submit the test? This action cannot be undone."
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);

    try {
      // Calculate time spent
      const timeSpentSeconds = startTimeRef.current
        ? Math.floor((new Date().getTime() - startTimeRef.current.getTime()) / 1000)
        : test.durationMinutes * 60;

      // Process all answers
      const responses = processAnswers(questions, answers);

      // Calculate statistics
      const totalQuestions = questions.length;
      const answeredQuestions = responses.filter((r) => r.studentAnswer !== null).length;
      const correctAnswers = responses.filter((r) => r.isCorrect).length;
      const incorrectAnswers = responses.filter((r) => r.studentAnswer !== null && !r.isCorrect).length;
      const notAnswered = totalQuestions - answeredQuestions;
      const totalMarksObtained = responses.reduce((sum, r) => sum + r.marksObtained, 0);
      const totalMarksPossible = questions.reduce((sum, q) => sum + q.testMarks, 0);

      // Create test result
      const resultInput = {
        testId: test.id,
        userId: user.uid,
        userName: user.displayName || undefined,
        userEmail: user.email || undefined,
        responses,
        totalQuestions,
        answeredQuestions,
        correctAnswers,
        incorrectAnswers,
        notAnswered,
        totalMarksObtained,
        totalMarksPossible,
        testTitle: test.title,
        testDurationMinutes: test.durationMinutes,
        timeSpentSeconds,
        startedAt: startTimeRef.current ? Timestamp.fromDate(startTimeRef.current) : undefined,
      };

      const resultId = await createTestResult(resultInput);

      // Navigate to results page
      router.push(`/dashboard/tests/${testId}/result/${resultId}`);
    } catch (error) {
      console.error("[TestTakingPage] Error submitting test:", error);
      alert("Failed to submit test. Please try again.");
      setIsSubmitting(false);
    }
  }, [test, user, questions, answers, testId, router]);

  // Store submit function in ref for timer
  useEffect(() => {
    handleSubmitTestRef.current = handleSubmitTest;
  }, [handleSubmitTest]);

  // Initialize timer
  useEffect(() => {
    if (test && test.durationMinutes) {
      const totalSeconds = test.durationMinutes * 60;
      setRemainingTime(totalSeconds);

      timerIntervalRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
            }
            // Auto-submit when time runs out (skip confirmation)
            if (handleSubmitTestRef.current) {
              handleSubmitTestRef.current(true);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    }
  }, [test]);

  // Get status counts
  const statusCounts = useMemo(() => {
    const counts = {
      answered: 0,
      not_answered: 0,
      not_visited: 0,
      marked_for_review: 0,
      answered_and_marked: 0,
    };
    
    questions.forEach((_, index) => {
      const status = getQuestionStatus(index);
      counts[status]++;
    });
    
    return counts;
  }, [questions, getQuestionStatus]);

  // Get status color
  const getStatusColor = useCallback((status: QuestionStatus): string => {
    switch (status) {
      case "answered":
        return "bg-green-500";
      case "not_answered":
        return "bg-red-500";
      case "not_visited":
        return "bg-gray-300";
      case "marked_for_review":
        return "bg-purple-500";
      case "answered_and_marked":
        return "bg-purple-500";
      default:
        return "bg-gray-300";
    }
  }, []);

  // Loading state
  if (authLoading || profileLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Loading test...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error || !test) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-red-600 mb-4">{error || "Test not found"}</p>
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

  // No questions
  if (questions.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">No Questions</h1>
            <p className="text-sm text-gray-600 mb-4">This test has no questions available.</p>
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

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers.get(currentQuestionIndex);

  return (
    <main className="min-h-screen bg-white overflow-x-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 w-full">
        <div className="max-w-7xl mx-auto px-4 w-full">
          {/* First Row: Title and Timer/Actions */}
          <div className="flex items-start justify-between py-3 gap-4">
            {/* Left: Test Title */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 truncate">{test.title}</h1>
            </div>

            {/* Right: Timer and Action Buttons */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              {/* Timer */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Remaining Time:</span>
                <span className={`text-base font-bold ${remainingTime < 300 ? "text-red-600" : "text-green-600"}`}>
                  {formatTime(remainingTime)}
                </span>
              </div>
              
              {/* Action Buttons - Below Timer */}
              <div className="flex items-center gap-3">
                <button className="text-sm text-gray-700 hover:text-gray-900 px-3 py-1 hover:bg-gray-100 rounded transition-colors">
                  Report an Error
                </button>
                <button className="text-sm text-gray-700 hover:text-gray-900 px-3 py-1 hover:bg-gray-100 rounded transition-colors">
                  Question Paper
                </button>
              </div>
            </div>
          </div>

          {/* Second Row: Subject Tabs and Mobile Menu Button */}
          <div className="flex items-center justify-between border-t border-gray-200 gap-2">
            {/* Subject and Subsection Tabs */}
            {test.sections && test.sections.length > 0 && (
              <div className="flex items-center overflow-x-auto flex-1 min-w-0">
                {test.sections
                  .sort((a, b) => a.order - b.order)
                  .map((section) => {
                    const isCurrentSection = currentSectionInfo?.section.id === section.id;
                    const sortedSubsections = [...section.subsections].sort((a, b) => a.order - b.order);
                    
                    return (
                      <div key={section.id} className="flex items-center">
                        {/* Section Tab */}
                        <button
                          onClick={() => handleGoToSection(section.id)}
                          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
                            isCurrentSection
                              ? "bg-blue-700 text-white border-blue-700"
                              : "bg-white text-gray-700 hover:bg-gray-50 border-transparent"
                          }`}
                        >
                          {section.name.toUpperCase()}
                        </button>
                        
                        {/* Subsection Tabs */}
                        {sortedSubsections.length > 0 && (
                          <div className="flex items-center border-l border-gray-300">
                            {sortedSubsections.map((subsection) => {
                              const isCurrentSubsection = currentSectionInfo?.subsection?.id === subsection.id;
                              return (
                                <button
                                  key={subsection.id}
                                  onClick={() => handleGoToSubsection(section.id, subsection.id)}
                                  className={`px-4 py-3 font-medium text-xs transition-all border-b-2 whitespace-nowrap ${
                                    isCurrentSubsection && isCurrentSection
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : isCurrentSection
                                      ? "bg-blue-50 text-gray-700 hover:bg-blue-100 border-transparent"
                                      : "bg-white text-gray-600 hover:bg-gray-50 border-transparent"
                                  }`}
                                >
                                  {subsection.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
            
            {/* Mobile Menu Button - Only visible on small screens */}
            <div className="lg:hidden">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="w-8 h-8 bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors mr-2"
                aria-label="Toggle Question Palette"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isSidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">
          {/* Main Question Area (Left - 2/3 width) */}
          <div className="lg:col-span-2 min-w-0">
            <div className="bg-white p-4 pb-24 w-full overflow-x-hidden">
              {/* Question Header */}
              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900 mb-2">
                  Question {currentQuestionIndex + 1}
                </h2>
                <div className="text-sm text-gray-700">
                  Marks for correct response: <span className="font-semibold">{currentQuestion.testMarks.toFixed(2)}</span>
                  {currentQuestion.testNegativeMarks > 0 && (
                    <>
                      {" | "}
                      Negative marking: <span className="font-semibold">{currentQuestion.testNegativeMarks.toFixed(2)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <div className="mb-4 w-full overflow-x-auto">
                <RichTextRenderer 
                  content={currentQuestion.text}
                  className="text-gray-900 text-sm break-words"
                />
              </div>

              {/* Question Image */}
              {currentQuestion.imageUrl && (
                <div className="mb-4 w-full overflow-x-auto">
                  <img
                    src={currentQuestion.imageUrl}
                    alt="Question"
                    className="max-w-full h-auto"
                  />
                </div>
              )}

              {/* Options (for MCQ) */}
              {currentQuestion.type !== "numerical" && currentQuestion.options && (
                <div className="mb-4">
                  <div className="space-y-1">
                    {currentQuestion.options.map((option, index) => {
                      const optionLabel = String.fromCharCode(65 + index);
                      const isSelected = currentQuestion.type === "mcq_single"
                        ? currentAnswer === index
                        : Array.isArray(currentAnswer) && currentAnswer.includes(index);
                      
                      return (
                        <label
                          key={index}
                          className="flex items-start gap-2 py-1.5 cursor-pointer"
                        >
                          <input
                            type={currentQuestion.type === "mcq_single" ? "radio" : "checkbox"}
                            name={`question-${currentQuestionIndex}`}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                            checked={isSelected}
                            onChange={() => {
                              if (currentQuestion.type === "mcq_single") {
                                handleAnswerSelect(currentQuestionIndex, index);
                              } else {
                                const current = (currentAnswer as number[]) || [];
                                const newAnswer = current.includes(index)
                                  ? current.filter((i) => i !== index)
                                  : [...current, index];
                                handleAnswerSelect(currentQuestionIndex, newAnswer);
                              }
                            }}
                          />
                          <span className="font-medium text-gray-700 min-w-[20px] text-sm">
                            {optionLabel}.
                          </span>
                          <div className="flex-1 min-w-0">
                            <RichTextRenderer 
                              content={option}
                              className="text-gray-900 text-sm break-words"
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Answer Input (for Numerical) */}
              {currentQuestion.type === "numerical" && (
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Your Answer:
                  </label>
                  <input
                    type="number"
                    step="any"
                    className="w-full border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter numerical answer"
                    value={currentAnswer as string || ""}
                    onChange={(e) => handleAnswerSelect(currentQuestionIndex, e.target.value)}
                  />
                </div>
              )}

            </div>
          </div>

          {/* Sidebar - Question Status & Palette (Right - 1/3 width) */}
          <div className="lg:col-span-1 hidden lg:block relative min-w-0">
            {/* Desktop Sidebar Content */}
            <div className="bg-white sticky top-32 flex flex-col w-full overflow-x-hidden" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
              {/* Scrollable Content */}
              <div className="p-3 overflow-y-auto flex-1 pb-20">
                {/* Status Legend */}
                <div className="mb-3 pb-3 border-b border-gray-200">
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-green-500"></div>
                      <span className="text-gray-700">{statusCounts.answered} Answered</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-red-500"></div>
                      <span className="text-gray-700">{statusCounts.not_answered} Not Answered</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-gray-300"></div>
                      <span className="text-gray-700">{statusCounts.not_visited} Not Visited</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-purple-500"></div>
                      <span className="text-gray-700">{statusCounts.marked_for_review} Marked for Review</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-purple-500 relative">
                        <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      </div>
                      <span className="text-gray-700">{statusCounts.answered_and_marked} Answered & Marked for Review (will be considered for evaluation)</span>
                    </div>
                  </div>
                </div>

                {/* Question Palette */}
                <div className="mb-3">
                  <h3 className="text-xs font-semibold text-gray-900 mb-2">Choose a Question</h3>
                  <div className="grid grid-cols-5 gap-1.5">
                    {questions.map((q, index) => {
                      const status = getQuestionStatus(index);
                      const isCurrent = index === currentQuestionIndex;
                      
                      return (
                        <button
                          key={index}
                          onClick={() => handleGoToQuestion(index)}
                          className={`aspect-square text-xs font-medium transition-all relative flex items-center justify-center ${
                            isCurrent
                              ? "ring-2 ring-blue-500"
                              : ""
                          } ${getStatusColor(status)} ${
                            status === "answered" || status === "answered_and_marked"
                              ? "text-white"
                              : "text-gray-700"
                          }`}
                          title={`Question ${index + 1}`}
                        >
                          {index + 1}
                          {status === "answered_and_marked" && (
                            <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-green-500"></div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Mobile Sidebar - Fixed Overlay */}
      {isSidebarOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
          
          {/* Sidebar Panel */}
          <div className="fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 flex flex-col lg:hidden overflow-x-hidden">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-20">
              {/* Close Button */}
              <div className="flex justify-end mb-3 pb-3 border-b border-gray-200">
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Status Legend */}
              <div className="mb-3 pb-3 border-b border-gray-200">
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span className="text-gray-700">{statusCounts.answered} Answered</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-red-500"></div>
                    <span className="text-gray-700">{statusCounts.not_answered} Not Answered</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-gray-300"></div>
                    <span className="text-gray-700">{statusCounts.not_visited} Not Visited</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-purple-500"></div>
                    <span className="text-gray-700">{statusCounts.marked_for_review} Marked for Review</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-purple-500 relative">
                      <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-gray-700">{statusCounts.answered_and_marked} Answered & Marked for Review (will be considered for evaluation)</span>
                  </div>
                </div>
              </div>

              {/* Question Palette */}
              <div className="mb-3">
                <h3 className="text-xs font-semibold text-gray-900 mb-2">Choose a Question</h3>
                <div className="grid grid-cols-5 gap-1.5">
                  {questions.map((q, index) => {
                    const status = getQuestionStatus(index);
                    const isCurrent = index === currentQuestionIndex;
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleGoToQuestion(index)}
                        className={`aspect-square text-xs font-medium transition-all relative flex items-center justify-center ${
                          isCurrent
                            ? "ring-2 ring-blue-500"
                            : ""
                        } ${getStatusColor(status)} ${
                          status === "answered" || status === "answered_and_marked"
                            ? "text-white"
                            : "text-gray-700"
                        }`}
                        title={`Question ${index + 1}`}
                      >
                        {index + 1}
                        {status === "answered_and_marked" && (
                          <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-green-500"></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 py-3 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">
            {/* Left side - Navigation Buttons (2/3 width on desktop) */}
            <div className="lg:col-span-2 flex items-center justify-center gap-3 flex-wrap min-w-0">
              <button
                onClick={handleMarkForReviewAndNext}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-all"
              >
                Mark for Review & Next
              </button>
              <button
                onClick={handleClearResponse}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-medium transition-all"
              >
                Clear Response
              </button>
              <button
                onClick={handleSaveAndNext}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-all"
              >
                Save & Next
              </button>
            </div>
            
            {/* Right side - Submit Button (1/3 width on desktop, full width on mobile) */}
            <div className="lg:col-span-1 min-w-0">
              <button
                onClick={handleSubmitTest}
                disabled={isSubmitting}
                className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
