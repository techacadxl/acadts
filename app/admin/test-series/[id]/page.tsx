// app/admin/test-series/[id]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getTestSeriesById } from "@/lib/db/testSeries";
import { getTestById } from "@/lib/db/tests";
import type { TestSeries } from "@/lib/types/testSeries";
import type { Test } from "@/lib/types/test";
import DescriptionRenderer from "@/components/DescriptionRenderer";
import RichTextRenderer from "@/components/RichTextRenderer";

export default function ViewTestSeriesPage() {
  const router = useRouter();
  const params = useParams();
  const testSeriesId = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();

  const [testSeries, setTestSeries] = useState<TestSeries | null>(null);
  const [tests, setTests] = useState<Map<string, Test>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTestSeries = useCallback(async () => {
    if (!testSeriesId) return;

    console.log("[ViewTestSeriesPage] Fetching test series:", testSeriesId);
    setLoading(true);
    setError(null);

    try {
      const seriesData = await getTestSeriesById(testSeriesId);
      if (!seriesData) {
        setError("Test series not found.");
        setLoading(false);
        return;
      }

      setTestSeries(seriesData);

      // Load all tests referenced in the series
      const testPromises = seriesData.testIds.map((testId) =>
        getTestById(testId)
      );
      const testResults = await Promise.all(testPromises);

      const testsMap = new Map<string, Test>();
      testResults.forEach((test) => {
        if (test) {
          testsMap.set(test.id, test);
        }
      });
      setTests(testsMap);

      console.log("[ViewTestSeriesPage] Test series loaded successfully");
      setLoading(false);
    } catch (err) {
      console.error("[ViewTestSeriesPage] Error loading test series:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load test series.";
      setError(errorMessage);
      setLoading(false);
    }
  }, [testSeriesId]);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      console.log("[ViewTestSeriesPage] No user, redirecting to login");
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      console.log("[ViewTestSeriesPage] Non-admin user, redirecting to dashboard");
      router.replace("/dashboard");
      return;
    }

    fetchTestSeries();
  }, [authLoading, profileLoading, user, role, router, fetchTestSeries]);

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
        <p className="p-4 text-gray-600">Loading test series...</p>
      </main>
    );
  }

  if (error || !testSeries) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-red-600 mb-4">{error || "Test series not found"}</p>
            <Link
              href="/admin/test-series"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              ← Back to Test Series
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
              href="/admin/test-series"
              className="text-sm text-blue-600 hover:text-blue-800 underline mb-2 inline-block"
            >
              ← Back to Test Series
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900">
              {testSeries.title}
            </h1>
          </div>
          <Link
            href={`/admin/test-series/${testSeriesId}/edit`}
            className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
          >
            Edit Series
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-6">
          {/* Thumbnail */}
          <div className="flex justify-center">
            {testSeries.thumbnail ? (
              <div className="w-full max-w-md h-64 bg-gray-100 rounded overflow-hidden">
                <img
                  src={testSeries.thumbnail}
                  alt={testSeries.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full max-w-md h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded flex items-center justify-center">
                <span className="text-6xl font-bold text-gray-400">
                  {testSeries.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Test Series Information */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-gray-200">
            <div>
              <p className="text-xs text-gray-500 mb-1">Price</p>
              <p className="text-sm font-medium text-gray-900">
                ${testSeries.price?.toFixed(2) || "0.00"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Tests</p>
              <p className="text-sm font-medium text-gray-900">
                {testSeries.testIds.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Questions</p>
              <p className="text-sm font-medium text-gray-900">
                {Array.from(tests.values()).reduce((sum, test) => sum + test.questions.length, 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Duration</p>
              <p className="text-sm font-medium text-gray-900">
                {Array.from(tests.values()).reduce((sum, test) => sum + test.durationMinutes, 0)} min
              </p>
            </div>
          </div>

          {testSeries.description && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Description</p>
              <RichTextRenderer content={testSeries.description} className="text-sm" />
            </div>
          )}

          {/* Tests List */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Tests in Series</p>
            <div className="space-y-3">
              {testSeries.testIds.map((testId, index) => {
                const test = tests.get(testId);
                const handleTestClick = () => {
                  if (test) {
                    router.push(`/admin/tests/${testId}`);
                  }
                };
                return (
                  <div
                    key={testId}
                    onClick={handleTestClick}
                    className={`border border-gray-200 rounded p-4 bg-gray-50 ${
                      test ? "cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            Test {index + 1}.
                          </span>
                          {test ? (
                            <>
                              <span className="text-sm font-semibold text-gray-900">
                                {test.title}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({test.durationMinutes} min, {test.questions.length} questions)
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500">
                              Test not found
                            </span>
                          )}
                        </div>
                        {test && test.description && (
                          <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                            <DescriptionRenderer description={test.description} className="text-sm" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}



