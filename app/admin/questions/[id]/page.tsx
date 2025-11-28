// app/admin/questions/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getQuestionById } from "@/lib/db/questions";
import type { Question } from "@/lib/types/question";
import Link from "next/link";

export default function ViewQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const questionId = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();

  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestion = useCallback(async () => {
    if (!questionId) return;

    console.log("[ViewQuestionPage] Fetching question:", questionId);
    setLoading(true);
    setError(null);

    try {
      const data = await getQuestionById(questionId);
      if (!data) {
        setError("Question not found.");
        return;
      }
      console.log("[ViewQuestionPage] Question loaded:", { id: data.id });
      setQuestion(data);
    } catch (err) {
      console.error("[ViewQuestionPage] Error fetching question:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load question.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      console.log("[ViewQuestionPage] No user, redirecting to login");
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      console.log("[ViewQuestionPage] Non-admin user, redirecting to dashboard");
      router.replace("/dashboard");
      return;
    }

    fetchQuestion();
  }, [authLoading, profileLoading, user, role, router, fetchQuestion]);

  const handleEdit = useCallback(() => {
    router.push(`/admin/questions/${questionId}/edit`);
  }, [router, questionId]);

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
        <p className="p-4 text-gray-600">Loading question...</p>
      </main>
    );
  }

  if (error || !question) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-red-600 mb-4">{error || "Question not found"}</p>
            <Link
              href="/admin/questions"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              ← Back to Questions
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/admin/questions"
              className="text-sm text-blue-600 hover:text-blue-800 underline mb-2 inline-block"
            >
              ← Back to Questions
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900">View Question</h1>
          </div>
          <button
            onClick={handleEdit}
            className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            aria-label="Edit question"
          >
            Edit Question
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-6">
          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-gray-200">
            <div>
              <p className="text-xs text-gray-500 mb-1">Subject</p>
              <p className="text-sm font-medium text-gray-900">{question.subject}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Topic</p>
              <p className="text-sm font-medium text-gray-900">{question.topic}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Type</p>
              <p className="text-sm font-medium text-gray-900">
                {question.type === "mcq_single"
                  ? "MCQ (Single)"
                  : question.type === "mcq_multiple"
                  ? "MCQ (Multiple)"
                  : "Numerical"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Difficulty</p>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  question.difficulty === "easy"
                    ? "bg-green-50 text-green-700"
                    : question.difficulty === "medium"
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
              </span>
            </div>
          </div>

          {/* Question Text */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Question</p>
            <div className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 rounded p-4">
              {question.text}
            </div>
          </div>

          {/* Question Image */}
          {question.imageUrl && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Image</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <img
                  src={question.imageUrl}
                  alt="Question illustration"
                  className="w-full h-auto max-h-96 object-contain bg-gray-50"
                  onError={(e) => {
                    console.error("[ViewQuestionPage] Error loading image:", question.imageUrl);
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          )}

          {/* Options (for MCQs) */}
          {(question.type === "mcq_single" || question.type === "mcq_multiple") &&
            question.options &&
            question.options.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Options</p>
                <div className="space-y-2">
                  {question.options.map((option, index) => {
                    const isCorrect = question.correctOptions?.includes(index);
                    return (
                      <div
                        key={index}
                        className={`flex items-start gap-2 p-3 rounded border ${
                          isCorrect
                            ? "bg-green-50 border-green-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <span className="text-sm font-medium text-gray-600 min-w-[2rem]">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        <span className="text-sm text-gray-900 flex-1">{option}</span>
                        {isCorrect && (
                          <span className="text-xs font-medium text-green-700">✓ Correct</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Correct Answer (for Numerical) */}
          {question.type === "numerical" && question.correctAnswer && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Correct Answer</p>
              <div className="text-sm font-medium text-gray-900 bg-green-50 border border-green-200 rounded p-3">
                {question.correctAnswer}
              </div>
            </div>
          )}

          {/* Explanation */}
          {question.explanation && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Explanation</p>
              <div className="text-sm text-gray-700 whitespace-pre-wrap bg-blue-50 border border-blue-200 rounded p-4">
                {question.explanation}
              </div>
            </div>
          )}

          {/* Scoring */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-500 mb-1">Marks</p>
              <p className="text-sm font-medium text-gray-900">{question.marks}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Penalty</p>
              <p className="text-sm font-medium text-gray-900">
                {question.penalty > 0 ? `-${question.penalty}` : "None"}
              </p>
            </div>
          </div>

          {/* Tags */}
          {question.tags && question.tags.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {question.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

