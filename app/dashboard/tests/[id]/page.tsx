// app/dashboard/tests/[id]/page.tsx
"use client";

import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { getTestById } from "@/lib/db/tests";
import { getQuestionById } from "@/lib/db/questions";
import type { Test } from "@/lib/types/test";
import type { Question } from "@/lib/types/question";
import type { TestQuestion } from "@/lib/types/test";

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
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Format time
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, []);

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
    <main className="min-h-screen bg-white">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4">
          {/* First Row: Title and Timer/Actions */}
          <div className="flex items-start justify-between py-2">
            {/* Left: Test Title */}
            <div>
              <h1 className="text-base font-semibold text-gray-900">{test.title}</h1>
            </div>

            {/* Right: Timer and Action Buttons */}
            <div className="flex flex-col items-end gap-2">
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
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to end the test? Your progress will be saved.")) {
                      router.push("/dashboard");
                    }
                  }}
                  className="text-sm text-gray-700 hover:text-gray-900 px-3 py-1 hover:bg-gray-100 rounded transition-colors"
                >
                  End Test
                </button>
              </div>
            </div>
          </div>

          {/* Second Row: Subject Tabs and Mobile Menu Button */}
          <div className="flex items-center justify-between border-t border-gray-200">
            {/* Subject Tabs */}
            {test.sections && test.sections.length > 0 && (
              <div className="flex items-center">
                {test.sections
                  .sort((a, b) => a.order - b.order)
                  .map((section) => {
                    const isCurrentSection = currentSectionInfo?.section.id === section.id;
                    return (
                      <button
                        key={section.id}
                        onClick={() => handleGoToSection(section.id)}
                        className={`px-8 py-3 font-bold text-sm transition-all border-b-2 ${
                          isCurrentSection
                            ? "bg-blue-700 text-white border-blue-700"
                            : "bg-white text-gray-700 hover:bg-gray-50 border-transparent"
                        }`}
                      >
                        {section.name.toUpperCase()}
                      </button>
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

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Question Area (Left - 2/3 width) */}
          <div className="lg:col-span-2">
            <div className="bg-white p-4">
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
              <div className="mb-4">
                <div
                  className="prose prose-sm max-w-none text-gray-900 question-content text-sm"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.text }}
                />
              </div>

              {/* Question Image */}
              {currentQuestion.imageUrl && (
                <div className="mb-4">
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
                          <div
                            className="prose prose-sm max-w-none text-gray-900 flex-1 question-content text-sm"
                            dangerouslySetInnerHTML={{ __html: option }}
                          />
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

              {/* Navigation Buttons */}
              <div className="flex items-center gap-3 pt-4">
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
            </div>
          </div>

          {/* Sidebar - Question Status & Palette (Right - 1/3 width) */}
          <div className="lg:col-span-1 hidden lg:block">
            {/* Desktop Sidebar Content */}
            <div className="bg-white p-3 sticky top-32">
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
                <div className="grid grid-cols-5 gap-1.5 max-h-96 overflow-y-auto">
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

              {/* Action Buttons */}
              <div className="space-y-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to submit the test? This action cannot be undone.")) {
                      router.push("/dashboard");
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all"
                >
                  Submit
                </button>
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
          <div className="fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 overflow-y-auto lg:hidden">
            <div className="p-3">
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
                <div className="grid grid-cols-5 gap-1.5 max-h-96 overflow-y-auto">
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

              {/* Action Buttons */}
              <div className="space-y-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to submit the test? This action cannot be undone.")) {
                      router.push("/dashboard");
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
