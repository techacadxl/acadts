// app/admin/questions/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { listQuestions, deleteQuestion } from "@/lib/db/questions";
import { cache } from "@/lib/utils/cache";
import Pagination from "@/components/Pagination";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Question } from "@/lib/types/question";

export default function AdminQuestionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Single unified search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchQuestions = useCallback(async () => {
    console.log("[AdminQuestionsPage] Fetching questions");
    setLoading(true);
    setError(null);

    try {
      // Fetch all questions - filtering will be done client-side
      // Invalidate cache to ensure fresh data
      cache.invalidatePattern("^questions:");
      
      // Fetch all questions without filters
      const data = await listQuestions({});
      console.log("[AdminQuestionsPage] Questions loaded:", {
        count: data.length,
      });
      setAllQuestions(data);
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

    // Fetch questions when auth is ready or when filters change
    // Invalidate cache to ensure fresh data
    fetchQuestions();
  }, [authLoading, profileLoading, user, role, router, fetchQuestions]);

  const handleCreateClick = useCallback(() => {
    router.push("/admin/questions/new");
  }, [router]);

  // Filter questions by unified search query (client-side filtering)
  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) {
      return allQuestions;
    }

    const searchLower = searchQuery.toLowerCase().trim();
    const searchTerms = searchLower.split(/\s+/).filter(term => term.length > 0);
    
    return allQuestions.filter((q) => {
      // Search in subject
      const subjectMatch = (q.subject || "").toLowerCase().includes(searchLower);
      
      // Search in chapter
      const chapterMatch = (q.chapter || "").toLowerCase().includes(searchLower);
      
      // Search in topic
      const topicMatch = (q.topic || "").toLowerCase().includes(searchLower);
      
      // Search in subtopic
      const subtopicMatch = (q.subtopic || "").toLowerCase().includes(searchLower);
      
      // Search in custom ID
      const customIdMatch = (q.customId || "").toLowerCase().includes(searchLower);
      
      // Search in tags (any tag contains the search term)
      const tagsMatch = (q.tags || []).some(tag => 
        tag.toLowerCase().includes(searchLower)
      );
      
      // Search in question text, options, and explanation
      const questionText = (q.text || "").toLowerCase();
      const optionsText = (q.options || []).join(" ").toLowerCase();
      const explanationText = (q.explanation || "").toLowerCase();
      const contentMatch = searchTerms.every(term => 
        questionText.includes(term) || 
        optionsText.includes(term) || 
        explanationText.includes(term)
      );
      
      // Match if any field contains the search query
      return subjectMatch || 
             chapterMatch || 
             topicMatch || 
             subtopicMatch || 
             customIdMatch || 
             tagsMatch || 
             contentMatch;
    });
  }, [allQuestions, searchQuery]);

  // Paginated questions
  const paginatedQuestions = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredQuestions.slice(startIndex, endIndex);
  }, [filteredQuestions, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredQuestions.length / pageSize);
  }, [filteredQuestions.length, pageSize]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
  }, []);

  const hasActiveFilters = useMemo(() => {
    return !!searchQuery.trim();
  }, [searchQuery]);

  const handleDelete = useCallback(
    async (id: string) => {
      const q = allQuestions.find((q) => q.id === id);
      const label = q ? `${q.subject} / ${q.chapter || 'N/A'} / ${q.topic} / ${q.subtopic || 'N/A'}` : id;

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
        setAllQuestions((prev) => prev.filter((q) => q.id !== id));
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
    [allQuestions, fetchQuestions]
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
      <div className="max-w-7xl mx-auto px-6 py-8">
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

        {/* Filter Section */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 rounded text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Filter Panel */}
          <div className="space-y-4">
            {/* Unified Search */}
            <div>
              <label className="block mb-1 text-xs font-medium text-gray-700">
                Search Questions
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by subject, chapter, topic, subtopic, custom ID, tags, or question content..."
              />
              <p className="mt-1 text-xs text-gray-500">
                Searches across all fields: subject, chapter, topic, subtopic, custom ID, tags, and question content.
              </p>
            </div>

            {/* Results Count and Page Size */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {paginatedQuestions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, filteredQuestions.length)} of {filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''}
                {hasActiveFilters && (
                  <span className="ml-2 text-gray-500">
                    (filtered from {allQuestions.length} total)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Items per page:</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded-lg p-6 bg-white text-center">
            {allQuestions.length === 0 ? (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  No questions found in the question bank.
                </p>
                <button
                  onClick={handleCreateClick}
                  className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                >
                  Create your first question
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-2">
                  No questions match your search and filter criteria.
                </p>
                <button
                  onClick={handleClearFilters}
                  className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                >
                  Clear Filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 whitespace-nowrap">
                    Custom ID
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 whitespace-nowrap">
                    Subject
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 whitespace-nowrap">
                    Chapter
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 whitespace-nowrap">
                    Topic
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 whitespace-nowrap">
                    Subtopic
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 whitespace-nowrap">
                    Type
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 whitespace-nowrap">
                    Difficulty
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 whitespace-nowrap">
                    Scoring
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-gray-700 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuestions.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b last:border-b-0 border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-3">
                      {q.customId ? (
                        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                          {q.customId}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-900 whitespace-nowrap">{q.subject}</td>
                    <td className="px-6 py-3 text-gray-700 whitespace-nowrap">{q.chapter || 'N/A'}</td>
                    <td className="px-6 py-3 text-gray-700 whitespace-nowrap">{q.topic}</td>
                    <td className="px-6 py-3 text-gray-700 whitespace-nowrap">{q.subtopic || 'N/A'}</td>
                    <td className="px-6 py-3 text-gray-700 whitespace-nowrap">
                      {q.type === "mcq_single"
                        ? "MCQ (Single)"
                        : q.type === "mcq_multiple"
                        ? "MCQ (Multiple)"
                        : "Numerical"}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
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
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-green-600">+{q.marks}</span>
                        {q.penalty > 0 && (
                          <span className="text-sm font-semibold text-red-600">-{q.penalty}</span>
                        )}
                        {q.penalty === 0 && (
                          <span className="text-xs text-gray-400">(no penalty)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/questions/${q.id}`)}
                          className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 cursor-pointer transition-colors"
                          aria-label={`View question ${q.id}`}
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEdit(q.id)}
                          className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 cursor-pointer transition-colors"
                          aria-label={`Edit question ${q.id}`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          disabled={deletingId === q.id}
                          className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 cursor-pointer transition-colors"
                          aria-label={`Delete question ${q.id}`}
                        >
                          {deletingId === q.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredQuestions.length > 0 && totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isLoading={loading}
            />
          </div>
        )}
      </div>
    </main>
  );
}
