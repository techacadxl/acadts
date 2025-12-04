"use client";

import { FormEvent, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { createTest } from "@/lib/db/tests";
import { listQuestions } from "@/lib/db/questions";
import type { Question } from "@/lib/types/question";
import type { TestInput, TestQuestion } from "@/lib/types/test";
import { sanitizeInput } from "@/lib/utils/validation";

export default function NewTestPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<string>("60");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Map<string, { marks: string; negativeMarks: string }>>(new Map());
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchCustomId, setSearchCustomId] = useState("");

  // Load questions from question bank
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoadingQuestions(true);
        const data = await listQuestions();
        setQuestions(data);
      } catch (err) {
        console.error("[NewTestPage] Error loading questions:", err);
        setError("Failed to load questions. Please try again.");
      } finally {
        setLoadingQuestions(false);
      }
    };

    if (user && role === "admin") {
      loadQuestions();
    }
  }, [user, role]);

  // Handle question selection
  const handleQuestionToggle = useCallback((questionId: string, question: Question) => {
    setSelectedQuestions((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(questionId)) {
        newMap.delete(questionId);
      } else {
        // Initialize with question's default marks and penalty
        newMap.set(questionId, {
          marks: question.marks.toString(),
          negativeMarks: question.penalty.toString(),
        });
      }
      return newMap;
    });
  }, []);

  // Handle marks change for selected question
  const handleMarksChange = useCallback((questionId: string, field: "marks" | "negativeMarks", value: string) => {
    setSelectedQuestions((prev) => {
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

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      console.log("[NewTestPage] Form submitted, attempting to create test");

      if (!user) {
        setError("You must be logged in to create tests.");
        return;
      }

      // Basic validation
      const sanitizedTitle = sanitizeInput(title).trim();
      const sanitizedDescription = sanitizeInput(description).trim();
      const parsedDuration = Number(durationMinutes);

      if (!sanitizedTitle) {
        setError("Test title is required.");
        return;
      }

      if (parsedDuration <= 0 || Number.isNaN(parsedDuration)) {
        setError("Duration must be a positive number.");
        return;
      }

      if (selectedQuestions.size === 0) {
        setError("Please select at least one question for the test.");
        return;
      }

      // Validate marks for each selected question
      const testQuestions: TestQuestion[] = [];
      let order = 0;

      for (const [questionId, scoring] of selectedQuestions.entries()) {
        const marks = Number(scoring.marks);
        const negativeMarks = Number(scoring.negativeMarks);

        if (Number.isNaN(marks) || marks <= 0) {
          setError(`Question ${order + 1} must have positive marks.`);
          return;
        }

        if (Number.isNaN(negativeMarks) || negativeMarks < 0) {
          setError(`Question ${order + 1} cannot have negative marking less than 0.`);
          return;
        }

        testQuestions.push({
          questionId,
          marks,
          negativeMarks,
          order: order++,
        });
      }

      setSubmitting(true);
      setError(null);

      try {
        const input: TestInput = {
          title: sanitizedTitle,
          description: sanitizedDescription,
          durationMinutes: parsedDuration,
          questions: testQuestions,
        };

        console.log("[NewTestPage] Final TestInput:", input);

        const id = await createTest(input, user.uid);
        console.log("[NewTestPage] Test created with id:", id);
        router.push("/admin/tests");
      } catch (err) {
        console.error("[NewTestPage] Error creating test:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create test. Please try again.";
        setError(errorMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [user, title, description, durationMinutes, selectedQuestions, router]
  );

  const handleCancel = useCallback(() => {
    router.push("/admin/tests");
  }, [router]);

  // Check admin access
  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      console.log("[NewTestPage] No user, redirecting to login");
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      console.log("[NewTestPage] Non-admin user, redirecting to dashboard");
      router.replace("/dashboard");
    }
  }, [authLoading, profileLoading, user, role, router]);

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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              Create New Test
            </h1>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-600 hover:text-gray-800 underline focus:outline-none"
            >
              Back to tests
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Create a new test by selecting questions from the question bank.
          </p>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Basic Test Information */}
            <div className="border-b border-gray-200 pb-4">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Test Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Test Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Physics Mock Test 1"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the test..."
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Duration (minutes) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    min={1}
                    step="1"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Question Selection */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Select Questions ({selectedQuestions.size} selected)
                </h2>
              </div>

              {/* Search by Custom ID */}
              <div className="mb-4">
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Search by Custom ID
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={searchCustomId}
                  onChange={(e) => setSearchCustomId(e.target.value)}
                  placeholder="e.g. PHY-001, MATH-2024-01"
                />
              </div>

              {loadingQuestions ? (
                <div className="text-center py-8 text-gray-600">
                  Loading questions...
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-8 text-gray-600 border border-dashed border-gray-300 rounded">
                  No questions available in the question bank. Please create questions first.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
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
                      {questions
                        .filter((q) => {
                          if (!searchCustomId.trim()) return true;
                          const searchLower = searchCustomId.toLowerCase().trim();
                          const customIdLower = (q.customId || "").toLowerCase();
                          return customIdLower.includes(searchLower);
                        })
                        .map((q) => {
                        const isSelected = selectedQuestions.has(q.id);
                        const scoring = selectedQuestions.get(q.id);
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
                                      value={scoring?.marks || q.marks}
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
                                      value={scoring?.negativeMarks || q.penalty}
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

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || selectedQuestions.size === 0}
                className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
              >
                {submitting ? "Creating..." : "Create Test"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}



