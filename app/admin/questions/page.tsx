// app/admin/questions/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { listQuestions, deleteQuestion, type ListQuestionsParams } from "@/lib/db/questions";
import type { Question, QuestionType, DifficultyLevel } from "@/lib/types/question";
import {
  getSubjects,
  getChaptersBySubject,
  getTopicsByChapter,
  getSubtopicsByTopic,
} from "@/lib/utils/subjectData";

export default function AdminQuestionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter states (using IDs for cascading, names for database queries)
  const [filterSubjectId, setFilterSubjectId] = useState("");
  const [filterSubjectName, setFilterSubjectName] = useState("");
  const [filterChapterId, setFilterChapterId] = useState("");
  const [filterChapterName, setFilterChapterName] = useState("");
  const [filterTopicId, setFilterTopicId] = useState("");
  const [filterTopicName, setFilterTopicName] = useState("");
  const [filterSubtopic, setFilterSubtopic] = useState("");
  const [filterType, setFilterType] = useState<QuestionType | "">("");
  const [filterDifficulty, setFilterDifficulty] = useState<DifficultyLevel | "">("");
  const [showFilters, setShowFilters] = useState(false);

  // Load subjects data for filters
  const subjects = getSubjects();
  const filterChapters = filterSubjectId ? getChaptersBySubject(filterSubjectId) : [];
  const filterTopics = filterSubjectId && filterChapterId ? getTopicsByChapter(filterSubjectId, filterChapterId) : [];
  const filterSubtopics = filterSubjectId && filterChapterId && filterTopicId
    ? getSubtopicsByTopic(filterSubjectId, filterChapterId, filterTopicId)
    : [];

  const fetchQuestions = useCallback(async () => {
    console.log("[AdminQuestionsPage] Fetching questions");
    setLoading(true);
    setError(null);

    try {
      // Build filter params (use names for database queries)
      const filterParams: ListQuestionsParams = {};
      if (filterSubjectName) filterParams.subject = filterSubjectName;
      if (filterChapterName) filterParams.chapter = filterChapterName;
      if (filterTopicName) filterParams.topic = filterTopicName;
      if (filterSubtopic) filterParams.subtopic = filterSubtopic;
      if (filterType) filterParams.type = filterType;
      if (filterDifficulty) filterParams.difficulty = filterDifficulty;

      const data = await listQuestions(filterParams);
      console.log("[AdminQuestionsPage] Questions loaded:", {
        count: data.length,
        filters: filterParams,
      });
      setAllQuestions(data);
    } catch (err) {
      console.error("[AdminQuestionsPage] Error fetching questions:", err);
      setError("Failed to load questions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filterSubjectName, filterChapterName, filterTopicName, filterSubtopic, filterType, filterDifficulty]);

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
    fetchQuestions();
  }, [authLoading, profileLoading, user, role, router, fetchQuestions]);

  const handleCreateClick = useCallback(() => {
    router.push("/admin/questions/new");
  }, [router]);

  // Questions are already filtered from database, just use them directly
  const filteredQuestions = allQuestions;

  // Reset dependent filters when parent changes
  useEffect(() => {
    if (!filterSubjectId) {
      setFilterChapterId("");
      setFilterChapterName("");
      setFilterTopicId("");
      setFilterTopicName("");
      setFilterSubtopic("");
    }
  }, [filterSubjectId]);

  useEffect(() => {
    if (!filterChapterId) {
      setFilterTopicId("");
      setFilterTopicName("");
      setFilterSubtopic("");
    }
  }, [filterChapterId]);

  useEffect(() => {
    if (!filterTopicId) {
      setFilterSubtopic("");
    }
  }, [filterTopicId]);

  // Handle subject change
  const handleFilterSubjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setFilterSubjectId(selectedId);
    const selectedSubject = subjects.find(s => s.id === selectedId);
    setFilterSubjectName(selectedSubject?.name || "");
  };

  // Handle chapter change
  const handleFilterChapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setFilterChapterId(selectedId);
    const selectedChapter = filterChapters.find(c => c.id === selectedId);
    setFilterChapterName(selectedChapter?.name || "");
  };

  // Handle topic change
  const handleFilterTopicChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setFilterTopicId(selectedId);
    const selectedTopic = filterTopics.find(t => t.id === selectedId);
    setFilterTopicName(selectedTopic?.name || "");
  };

  const handleClearFilters = useCallback(() => {
    setFilterSubjectId("");
    setFilterSubjectName("");
    setFilterChapterId("");
    setFilterChapterName("");
    setFilterTopicId("");
    setFilterTopicName("");
    setFilterSubtopic("");
    setFilterType("");
    setFilterDifficulty("");
  }, []);

  const hasActiveFilters = useMemo(() => {
    return !!(
      filterSubjectName ||
      filterChapterName ||
      filterTopicName ||
      filterSubtopic ||
      filterType ||
      filterDifficulty
    );
  }, [filterSubjectName, filterChapterName, filterTopicName, filterSubtopic, filterType, filterDifficulty]);

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

        {/* Filter Section */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded text-sm border transition-colors ${
                showFilters
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {showFilters ? "Hide Filters" : "Show Filters"}
            </button>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 rounded text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Clear All
              </button>
              )}
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="border-t border-gray-200 pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Subject Filter */}
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    Subject
                  </label>
                  <select
                    value={filterSubjectId}
                    onChange={handleFilterSubjectChange}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">All Subjects</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chapter Filter */}
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    Chapter
                  </label>
                  <select
                    value={filterChapterId}
                    onChange={handleFilterChapterChange}
                    disabled={!filterSubjectId}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">{filterSubjectId ? "All Chapters" : "Select Subject First"}</option>
                    {filterChapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Topic Filter */}
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    Topic
                  </label>
                  <select
                    value={filterTopicId}
                    onChange={handleFilterTopicChange}
                    disabled={!filterChapterId}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">{filterChapterId ? "All Topics" : "Select Chapter First"}</option>
                    {filterTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Subtopic Filter */}
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    Subtopic
                  </label>
                  <select
                    value={filterSubtopic}
                    onChange={(e) => setFilterSubtopic(e.target.value)}
                    disabled={!filterTopicId}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">{filterTopicId ? "All Subtopics" : "Select Topic First"}</option>
                    {filterSubtopics.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    Type
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as QuestionType | "")}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">All Types</option>
                    <option value="mcq_single">MCQ (Single)</option>
                    <option value="mcq_multiple">MCQ (Multiple)</option>
                    <option value="numerical">Numerical</option>
                  </select>
                </div>

                {/* Difficulty Filter */}
                <div>
                  <label className="block mb-1 text-xs font-medium text-gray-700">
                    Difficulty
                  </label>
                  <select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value as DifficultyLevel | "")}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">All Difficulties</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Results Count */}
          <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
            Showing {filteredQuestions.length} of {allQuestions.length} question{allQuestions.length !== 1 ? 's' : ''}
            {hasActiveFilters && (
              <span className="ml-2 text-gray-500">
                (filtered)
              </span>
            )}
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
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Subject
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Chapter
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Topic
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Subtopic
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
                {filteredQuestions.map((q) => (
                  <tr
                    key={q.id}
                    className="border-b last:border-b-0 border-gray-100"
                  >
                    <td className="px-4 py-2 text-gray-900">{q.subject}</td>
                    <td className="px-4 py-2 text-gray-700">{q.chapter || 'N/A'}</td>
                    <td className="px-4 py-2 text-gray-700">{q.topic}</td>
                    <td className="px-4 py-2 text-gray-700">{q.subtopic || 'N/A'}</td>
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
