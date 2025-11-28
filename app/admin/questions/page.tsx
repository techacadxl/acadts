// app/admin/questions/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { listQuestions, deleteQuestion } from "@/lib/db/questions";
import type { Question } from "@/lib/types/question";

export default function AdminQuestionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    console.log("[AdminQuestionsPage] Fetching questions");
    setLoading(true);
    setError(null);

    try {
      const data = await listQuestions();
      console.log("[AdminQuestionsPage] Questions loaded:", {
        count: data.length,
      });
      setQuestions(data);
    } catch (err) {
      console.error("[AdminQuestionsPage] Error fetching questions:", err);
      setError("Failed to load questions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      console.log("[AdminQuestionsPage] No user, redirecting to login");
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      console.log("[AdminQuestionsPage] Non-admin user, redirecting to dashboard");
      router.replace("/dashboard");
      return;
    }

    fetchQuestions();
  }, [authLoading, profileLoading, user, role, router, fetchQuestions]);

  const handleCreateClick = useCallback(() => {
    router.push("/admin/questions/new");
  }, [router]);

  const handleDelete = useCallback(
    async (id: string) => {
      const q = questions.find((q) => q.id === id);
      const label = q ? `${q.subject} / ${q.topic}` : id;

      const confirmed = typeof window !== "undefined"
        ? window.confirm(
            `Are you sure you want to delete this question?\n\n${label}`
          )
        : false;

      if (!confirmed) return;

      console.log("[AdminQuestionsPage] Deleting question:", id);
      setDeletingId(id);

      try {
        await deleteQuestion(id);
        console.log("[AdminQuestionsPage] Question deleted:", id);
        // Optimistically update local state
        setQuestions((prev) => prev.filter((q) => q.id !== id));
        setError(null); // Clear any previous errors on success
      } catch (err) {
        console.error("[AdminQuestionsPage] Error deleting question:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to delete question. Please try again.";
        setError(errorMessage);
        // Refresh the list to ensure consistency
        fetchQuestions();
      } finally {
        setDeletingId(null);
      }
    },
    [questions]
  );

  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/admin/questions/${id}`);
    },
    [router]
  );

  // ---------- Render ----------

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
        <p className="p-4 text-gray-600">Loading questions...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Manage Questions
            </h1>
            <p className="text-sm text-gray-600">
              View, edit, and delete questions from the question bank.
            </p>
          </div>

          <button
            onClick={handleCreateClick}
            className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            aria-label="Create new question"
          >
            + New Question
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}

        {questions.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-lg p-6 bg-white text-center">
            <p className="text-sm text-gray-600 mb-2">
              No questions found in the question bank.
            </p>
            <button
              onClick={handleCreateClick}
              className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            >
              Create your first question
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Subject
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Topic
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Type
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Difficulty
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Marks
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b last:border-b-0 border-gray-100"
                  >
                    <td className="px-4 py-2 text-gray-900">{q.subject}</td>
                    <td className="px-4 py-2 text-gray-700">{q.topic}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {q.type === "mcq_single"
                        ? "MCQ (Single)"
                        : q.type === "mcq_multiple"
                        ? "MCQ (Multiple)"
                        : "Numerical"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " +
                          (q.difficulty === "easy"
                            ? "bg-green-50 text-green-700"
                            : q.difficulty === "medium"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-700")
                        }
                      >
                        {q.difficulty.charAt(0).toUpperCase() +
                          q.difficulty.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{q.marks}</td>
                    <td className="px-4 py-2 space-x-2">
                      <button
                        onClick={() => router.push(`/admin/questions/${q.id}`)}
                        className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                        aria-label={`View question ${q.id}`}
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(q.id)}
                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                        aria-label={`Edit question ${q.id}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        disabled={deletingId === q.id}
                        className="text-xs px-2 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
                        aria-label={`Delete question ${q.id}`}
                      >
                        {deletingId === q.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
