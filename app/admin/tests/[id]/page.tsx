// app/admin/tests/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getTestById, updateTest } from "@/lib/db/tests";
import { getQuestionById, listQuestions } from "@/lib/db/questions";
import type { Test } from "@/lib/types/test";
import type { Question } from "@/lib/types/question";
import type { TestSection, TestSubsection, TestQuestion } from "@/lib/types/test";
import RichTextRenderer from "@/components/RichTextRenderer";

interface QuestionWithTestData extends Question {
  testMarks: number;
  testNegativeMarks: number;
  order: number;
  sectionId: string;
  subsectionId: string;
}

export default function ViewTestPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Map<string, Question>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSubsectionId, setSelectedSubsectionId] = useState<string | null>(null);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingQuestionId, setAddingQuestionId] = useState<string | null>(null);
  const [selectedQuestionsForAdd, setSelectedQuestionsForAdd] = useState<Map<string, { marks: string; negativeMarks: string }>>(new Map());

  const fetchTest = useCallback(async () => {
    if (!testId) return;

    console.log("[ViewTestPage] Fetching test:", testId);
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

      // Set default selected section/subsection
      if (testData.sections && testData.sections.length > 0) {
        const firstSection = testData.sections[0];
        setSelectedSectionId(firstSection.id);
        if (firstSection.subsections && firstSection.subsections.length > 0) {
          setSelectedSubsectionId(firstSection.subsections[0].id);
        }
      }

      // Load all questions referenced in the test
      const questionPromises = testData.questions.map((tq) =>
        getQuestionById(tq.questionId)
      );
      const questionResults = await Promise.all(questionPromises);

      const questionsMap = new Map<string, Question>();
      questionResults.forEach((q) => {
        if (q) {
          questionsMap.set(q.id, q);
        }
      });
      setQuestions(questionsMap);

      console.log("[ViewTestPage] Test loaded successfully");
      setLoading(false);
    } catch (err) {
      console.error("[ViewTestPage] Error loading test:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load test.";
      setError(errorMessage);
      setLoading(false);
    }
  }, [testId]);

  const loadAvailableQuestions = useCallback(async () => {
    setLoadingQuestions(true);
    try {
      const allQuestions = await listQuestions();
      // Filter out questions already in the test
      const testQuestionIds = new Set(test?.questions.map((q) => q.questionId) || []);
      const filtered = allQuestions.filter((q) => !testQuestionIds.has(q.id));
      setAvailableQuestions(filtered);
    } catch (err) {
      console.error("[ViewTestPage] Error loading questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  }, [test]);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      console.log("[ViewTestPage] No user, redirecting to login");
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      console.log("[ViewTestPage] Non-admin user, redirecting to dashboard");
      router.replace("/dashboard");
      return;
    }

    fetchTest();
  }, [authLoading, profileLoading, user, role, router, fetchTest]);

  useEffect(() => {
    if (showAddQuestionModal && test) {
      loadAvailableQuestions();
    }
  }, [showAddQuestionModal, test, loadAvailableQuestions]);

  // Get questions for selected section/subsection
  const filteredQuestions = useMemo(() => {
    if (!test || !selectedSectionId || !selectedSubsectionId) return [];

    return test.questions
      .filter(
        (tq) =>
          tq.sectionId === selectedSectionId &&
          tq.subsectionId === selectedSubsectionId
      )
      .sort((a, b) => a.order - b.order)
      .map((tq) => {
        const question = questions.get(tq.questionId);
        if (!question) return null;
        return {
          ...question,
          testMarks: tq.marks,
          testNegativeMarks: tq.negativeMarks,
          order: tq.order,
          sectionId: tq.sectionId,
          subsectionId: tq.subsectionId,
        } as QuestionWithTestData;
      })
      .filter((q): q is QuestionWithTestData => q !== null);
  }, [test, questions, selectedSectionId, selectedSubsectionId]);

  // Get filtered available questions for modal
  const filteredAvailableQuestions = useMemo(() => {
    if (!searchQuery.trim()) return availableQuestions;
    const query = searchQuery.toLowerCase().trim();
    return availableQuestions.filter((q) => {
      const customIdLower = (q.customId || "").toLowerCase();
      return customIdLower.includes(query);
    });
  }, [availableQuestions, searchQuery]);

  const handleQuestionToggle = useCallback((questionId: string, question: Question) => {
    setSelectedQuestionsForAdd((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(questionId)) {
        newMap.delete(questionId);
      } else {
        newMap.set(questionId, {
          marks: question.marks.toString(),
          negativeMarks: question.penalty.toString(),
        });
      }
      return newMap;
    });
  }, []);

  const handleMarksChange = useCallback((questionId: string, field: "marks" | "negativeMarks", value: string) => {
    setSelectedQuestionsForAdd((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(questionId);
      if (current) {
        newMap.set(questionId, {
          ...current,
          [field]: value,
        });
      }
      return newMap;
    });
  }, []);

  const handleAddSelectedQuestions = useCallback(async () => {
    if (!test || !selectedSectionId || !selectedSubsectionId) return;

    if (selectedQuestionsForAdd.size === 0) {
      setError("Please select at least one question");
      return;
    }

    setAddingQuestionId("batch");
    setError(null);

    try {
      const maxOrder = test.questions.length > 0 ? Math.max(...test.questions.map((q) => q.order)) : 0;
      const newTestQuestions: TestQuestion[] = [];
      let currentOrder = maxOrder + 1;

      for (const [questionId, data] of selectedQuestionsForAdd.entries()) {
        const marksNum = Number(data.marks);
        const negativeMarksNum = Number(data.negativeMarks);

        if (isNaN(marksNum) || marksNum <= 0) {
          setError(`Question ${questionId}: Marks must be a positive number`);
          setAddingQuestionId(null);
          return;
        }

        if (isNaN(negativeMarksNum) || negativeMarksNum < 0) {
          setError(`Question ${questionId}: Negative marks cannot be less than 0`);
          setAddingQuestionId(null);
          return;
        }

        newTestQuestions.push({
          questionId,
          marks: marksNum,
          negativeMarks: negativeMarksNum,
          order: currentOrder++,
          sectionId: selectedSectionId,
          subsectionId: selectedSubsectionId,
        });
      }

      // Add all questions to test
      const updatedQuestions = [...test.questions, ...newTestQuestions];
      await updateTest(testId, { questions: updatedQuestions });

      // Update local state - load new questions
      const questionPromises = newTestQuestions.map((tq) => getQuestionById(tq.questionId));
      const questionResults = await Promise.all(questionPromises);
      
      setQuestions((prev) => {
        const newMap = new Map(prev);
        questionResults.forEach((q) => {
          if (q) newMap.set(q.id, q);
        });
        return newMap;
      });

      setTest((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          questions: updatedQuestions,
        };
      });

      // Reload available questions and reset
      await loadAvailableQuestions();
      setSelectedQuestionsForAdd(new Map());
      setShowAddQuestionModal(false);
      setSearchQuery("");
    } catch (err) {
      console.error("[ViewTestPage] Error adding questions:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to add questions to test.";
      setError(errorMessage);
    } finally {
      setAddingQuestionId(null);
    }
  }, [test, testId, selectedSectionId, selectedSubsectionId, selectedQuestionsForAdd, loadAvailableQuestions]);


  const handleDeleteFromTest = useCallback(
    async (questionId: string) => {
      if (!test) return;

      const confirmed = window.confirm(
        `Are you sure you want to remove this question from the test?\n\nThis will not delete the question from the question bank.`
      );

      if (!confirmed) return;

      try {
        // Remove the question from the test's questions array
        const updatedQuestions = test.questions
          .filter((q) => q.questionId !== questionId)
          .map((q, idx) => ({ ...q, order: idx + 1 })); // Reorder

        await updateTest(testId, { questions: updatedQuestions });

        // Update local state
        setTest((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            questions: updatedQuestions,
          };
        });

        // Remove from questions map
        setQuestions((prev) => {
          const newMap = new Map(prev);
          newMap.delete(questionId);
          return newMap;
        });

        // Reload available questions
        await loadAvailableQuestions();
      } catch (err) {
        console.error("[ViewTestPage] Error removing question from test:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to remove question from test.";
        setError(errorMessage);
      }
    },
    [test, testId, loadAvailableQuestions]
  );

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="p-4 text-gray-600">Checking admin access...</p>
      </main>
    );
  }

  if (!user || role !== "admin") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="p-4 text-gray-600">Redirecting...</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="p-4 text-gray-600">Loading test...</p>
      </main>
    );
  }

  if (error && !test) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <Link
              href="/admin/tests"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              ← Back to Tests
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!test) return null;

  const selectedSection = test.sections?.find((s) => s.id === selectedSectionId);
  const selectedSubsection = selectedSection?.subsections.find(
    (s) => s.id === selectedSubsectionId
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
        {/* Side Panel */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          {/* Side Panel Header */}
          <div className="p-4 border-b border-gray-200">
            <Link
              href="/admin/tests"
              className="text-sm text-blue-600 hover:text-blue-800 underline mb-2 inline-block"
            >
              ← Back to Tests
            </Link>
            <h2 className="text-lg font-semibold text-gray-900 truncate">
              {test.title}
            </h2>
            <div className="mt-2 text-xs text-gray-500 space-y-1">
              <p>{test.durationMinutes} min</p>
              <p>{test.questions.length} Questions</p>
              <p>
                {test.questions.reduce((sum, q) => sum + q.marks, 0)} Marks
              </p>
            </div>
          </div>

          {/* Navigation Tree */}
          <div className="flex-1 overflow-y-auto p-4">
            {!test.sections || test.sections.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                <p>No sections defined</p>
                <p className="text-xs mt-2">Add sections to organize questions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {test.sections
                  .sort((a, b) => a.order - b.order)
                  .map((section) => {
                  const sectionQuestions = test.questions.filter(
                    (q) => q.sectionId === section.id
                  );
                  const isSelected = selectedSectionId === section.id;

                  return (
                    <div key={section.id} className="space-y-1">
                      <button
                        onClick={() => {
                          setSelectedSectionId(section.id);
                          if (section.subsections && section.subsections.length > 0) {
                            setSelectedSubsectionId(section.subsections[0].id);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{section.name}</span>
                          <span className="text-xs text-gray-500">
                            ({sectionQuestions.length})
                          </span>
                        </div>
                      </button>

                      {isSelected &&
                        section.subsections
                          ?.sort((a, b) => a.order - b.order)
                          .map((subsection) => {
                            const subsectionQuestions = test.questions.filter(
                              (q) =>
                                q.sectionId === section.id &&
                                q.subsectionId === subsection.id
                            );
                            const isSubSelected =
                              selectedSubsectionId === subsection.id;

                            return (
                              <button
                                key={subsection.id}
                                onClick={() => {
                                  setSelectedSubsectionId(subsection.id);
                                }}
                                className={`w-full text-left pl-6 pr-3 py-1.5 rounded-lg text-xs transition-colors ${
                                  isSubSelected
                                    ? "bg-blue-100 text-blue-800 font-medium"
                                    : "text-gray-600 hover:bg-gray-50"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{subsection.name}</span>
                                  <span className="text-xs">
                                    ({subsectionQuestions.length})
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {!test.sections || test.sections.length === 0
                    ? "Test Overview"
                    : selectedSection?.name || "Select Section"}
                  {selectedSubsection && ` • ${selectedSubsection.name}`}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {!test.sections || test.sections.length === 0
                    ? `${test.questions.length} total questions`
                    : `${filteredQuestions.length} question${filteredQuestions.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              {selectedSectionId && selectedSubsectionId && (
                <button
                  onClick={() => setShowAddQuestionModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLineCap="round"
                      strokeLineJoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Question
                </button>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-4 mt-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Questions List */}
          <div className="flex-1 overflow-y-auto p-4">
            {(!test.sections || test.sections.length === 0) ? (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    This test doesn't have sections defined. All questions are shown below.
                  </p>
                </div>
                {test.questions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-gray-500 mb-4">No questions in this test yet.</p>
                    <p className="text-sm text-gray-400">Please add sections and subsections to organize questions.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {test.questions
                      .sort((a, b) => a.order - b.order)
                      .map((tq, index) => {
                        const question = questions.get(tq.questionId);
                        if (!question) return null;

                        return (
                          <div
                            key={tq.questionId}
                            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className="text-sm font-semibold text-gray-900">
                                    Q{index + 1}.
                                  </span>
                                  {question.customId && (
                                    <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                      {question.customId}
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-600">
                                    {question.subject}
                                    {question.chapter && ` / ${question.chapter}`}
                                    {question.topic && ` / ${question.topic}`}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                                    {question.type === "mcq_single"
                                      ? "MCQ (Single)"
                                      : question.type === "mcq_multiple"
                                      ? "MCQ (Multiple)"
                                      : "Numerical"}
                                  </span>
                                </div>
                                <div className="text-sm text-gray-700 line-clamp-3">
                                  <RichTextRenderer content={question.text} />
                                </div>
                              </div>
                              <div className="ml-4 flex flex-col items-end gap-2">
                                <div className="text-right">
                                  <div className="text-xs text-gray-500 mb-1">Scoring</div>
                                  <div className="flex items-center gap-2 justify-end">
                                    <span className="text-sm font-semibold text-green-600">
                                      +{tq.marks}
                                    </span>
                                    {tq.negativeMarks > 0 ? (
                                      <span className="text-sm font-semibold text-red-600">
                                        -{tq.negativeMarks}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400">(no penalty)</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() =>
                                      router.push(
                                        `/admin/questions/${question.id}?fromTest=${testId}`
                                      )
                                    }
                                    className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFromTest(question.id)}
                                    className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : !selectedSectionId || !selectedSubsectionId ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Select a section and subsection to view questions</p>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-gray-500 mb-4">No questions in this subsection yet.</p>
                <button
                  onClick={() => setShowAddQuestionModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Add First Question
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredQuestions.map((question, index) => (
                  <div
                    key={question.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">
                            Q{index + 1}.
                          </span>
                          {question.customId && (
                            <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                              {question.customId}
                            </span>
                          )}
                          <span className="text-xs text-gray-600">
                            {question.subject}
                            {question.chapter && ` / ${question.chapter}`}
                            {question.topic && ` / ${question.topic}`}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                            {question.type === "mcq_single"
                              ? "MCQ (Single)"
                              : question.type === "mcq_multiple"
                              ? "MCQ (Multiple)"
                              : "Numerical"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 line-clamp-3 question-content">
                          <RichTextRenderer content={question.text} />
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col items-end gap-2">
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">Scoring</div>
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-sm font-semibold text-green-600">
                              +{question.testMarks}
                            </span>
                            {question.testNegativeMarks > 0 ? (
                              <span className="text-sm font-semibold text-red-600">
                                -{question.testNegativeMarks}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">(no penalty)</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              router.push(
                                `/admin/questions/${question.id}?fromTest=${testId}`
                              )
                            }
                            className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDeleteFromTest(question.id)}
                            className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Question Modal */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Add Question to Test
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedSection?.name} • {selectedSubsection?.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddQuestionModal(false);
                  setSearchQuery("");
                  setSelectedQuestionsForAdd(new Map());
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLineCap="round"
                    strokeLineJoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Active Subsection Info */}
            <div className="p-4 border-b border-gray-200 bg-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Adding questions to:</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedSection?.name} → {selectedSubsection?.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Search by Custom ID
              </label>
              <input
                type="text"
                placeholder="e.g. PHY-001, MATH-2024-01"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Questions Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingQuestions ? (
                <div className="text-center py-8 text-gray-600">Loading questions...</div>
              ) : filteredAvailableQuestions.length === 0 ? (
                <div className="text-center py-8 text-gray-600 border border-dashed border-gray-300 rounded">
                  {searchQuery
                    ? "No questions found matching your search."
                    : "No available questions to add."}
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-[600px] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-700 w-12">
                          Select
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Subject / Chapter / Topic
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Custom ID
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Type
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Difficulty
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Scoring (Marks / Penalty)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAvailableQuestions.map((q) => {
                        const questionData = selectedQuestionsForAdd.get(q.id);
                        const isSelected = !!questionData;

                        return (
                          <tr
                            key={q.id}
                            className={`border-b last:border-b-0 ${
                              isSelected ? "bg-blue-50" : ""
                            }`}
                          >
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={isSelected}
                                onChange={() => handleQuestionToggle(q.id, q)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-gray-900 font-medium">
                                {q.subject}
                                {q.chapter && ` / ${q.chapter}`}
                              </div>
                              <div className="text-gray-600 text-xs">
                                {q.topic}
                                {q.subtopic && ` / ${q.subtopic}`}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              {q.customId ? (
                                <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                  {q.customId}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-gray-700">
                              {q.type === "mcq_single"
                                ? "MCQ (Single)"
                                : q.type === "mcq_multiple"
                                ? "MCQ (Multiple)"
                                : "Numerical"}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  q.difficulty === "easy"
                                    ? "bg-green-50 text-green-700"
                                    : q.difficulty === "medium"
                                    ? "bg-yellow-50 text-yellow-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {isSelected ? (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1">
                                    <input
                                      type="number"
                                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                      value={questionData.marks}
                                      onChange={(e) => handleMarksChange(q.id, "marks", e.target.value)}
                                      min={1}
                                      step="1"
                                      required
                                    />
                                  </div>
                                  <span className="text-xs text-gray-400">/</span>
                                  <div className="flex-1">
                                    <input
                                      type="number"
                                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                      value={questionData.negativeMarks}
                                      onChange={(e) => handleMarksChange(q.id, "negativeMarks", e.target.value)}
                                      min={0}
                                      step="1"
                                      required
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-green-600">+{q.marks}</span>
                                  {q.penalty > 0 ? (
                                    <span className="text-sm font-semibold text-red-600">-{q.penalty}</span>
                                  ) : (
                                    <span className="text-xs text-gray-400">(no penalty)</span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedQuestionsForAdd.size > 0 && (
                  <span>{selectedQuestionsForAdd.size} question{selectedQuestionsForAdd.size !== 1 ? "s" : ""} selected</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddQuestionModal(false);
                    setSearchQuery("");
                    setSelectedQuestionsForAdd(new Map());
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSelectedQuestions}
                  disabled={addingQuestionId === "batch" || selectedQuestionsForAdd.size === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingQuestionId === "batch" ? "Adding..." : `Add ${selectedQuestionsForAdd.size > 0 ? `(${selectedQuestionsForAdd.size})` : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

