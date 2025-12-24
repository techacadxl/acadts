// app/dashboard/test-series/[id]/page.tsx
"use client";

import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useEffect, useState, useCallback } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getTestSeriesById } from "@/lib/db/testSeries";
import { enrollInTestSeries, isEnrolled } from "@/lib/db/students";
import { getTestById } from "@/lib/db/tests";
import { getUserTestResults } from "@/lib/db/testResults";
import type { TestSeries } from "@/lib/types/testSeries";
import type { Test } from "@/lib/types/test";
import DescriptionRenderer from "@/components/DescriptionRenderer";
import type { TestResult } from "@/lib/types/testResult";
import DescriptionRenderer from "@/components/DescriptionRenderer";

export default function TestSeriesDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [testSeries, setTestSeries] = useState<TestSeries | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolledInSeries, setIsEnrolledInSeries] = useState(false);
  const [testAttemptMap, setTestAttemptMap] = useState<Map<string, TestResult>>(new Map());

  const seriesId = params.id as string;

  // Load test series details
  useEffect(() => {
    if (authLoading || profileLoading || !seriesId) {
      console.log("[TestSeriesDetailsPage] Waiting for:", { authLoading, profileLoading, seriesId });
      return;
    }

    // If user is not logged in, redirect to login
    if (!user) {
      console.log("[TestSeriesDetailsPage] No user, redirecting to login");
      router.push("/login");
      return;
    }

    const loadData = async () => {
      setLoading(true);
      console.log("[TestSeriesDetailsPage] Loading test series:", seriesId);
      try {
        const series = await getTestSeriesById(seriesId);
        if (!series) {
          console.error("[TestSeriesDetailsPage] Test series not found:", seriesId);
          alert("Test series not found. Redirecting to dashboard.");
          router.push("/dashboard");
          return;
        }
        console.log("[TestSeriesDetailsPage] Test series loaded:", series.title);

        setTestSeries(series);

        // Check if enrolled
        const enrolled = await isEnrolled(user.uid, seriesId);
        setIsEnrolledInSeries(enrolled);

        // Load test results to check attempts
        const results = await getUserTestResults(user.uid);
        const attemptMap = new Map<string, TestResult>();
        results.forEach((result) => {
          attemptMap.set(result.testId, result);
        });
        setTestAttemptMap(attemptMap);

        // Load test details
        if (series.testIds && series.testIds.length > 0) {
          const testPromises = series.testIds.map(async (testId) => {
            const test = await getTestById(testId);
            return test;
          });
          const loadedTests = await Promise.all(testPromises);
          setTests(loadedTests.filter((t): t is Test => t !== null));
        }
      } catch (error) {
        console.error("[TestSeriesDetailsPage] Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, authLoading, profileLoading, seriesId, router]);

  // Redirect admins
  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (user && role === "admin") {
      router.replace("/admin");
    }
  }, [authLoading, profileLoading, user, role, router]);

  const handleLogout = useCallback(async () => {
    if (!user) return;
    try {
      // Clear login time
      if (typeof window !== "undefined") {
        localStorage.removeItem("user_login_time");
      }
      await signOut(auth);
      router.replace("/");
    } catch (err) {
      console.error("[TestSeriesDetailsPage] Logout error:", err);
    }
  }, [user, router]);

  const handleEnroll = useCallback(async () => {
    if (!user || !seriesId) return;
    setEnrolling(true);
    try {
      await enrollInTestSeries(user.uid, seriesId);
      setIsEnrolledInSeries(true);
      const isFree = !testSeries?.price || testSeries.price === 0;
      alert(
        isFree
          ? "Successfully enrolled in test series! You now have access to all tests."
          : "Purchase successful! You now have access to all tests in this series."
      );
    } catch (error) {
      console.error("[TestSeriesDetailsPage] Error enrolling:", error);
      alert("Failed to enroll. Please try again.");
    } finally {
      setEnrolling(false);
    }
  }, [user, seriesId, testSeries]);

  if (authLoading || profileLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1a0f0a] via-[#2d1810] to-[#ff6b35]">
        <p className="text-white text-lg">Loading...</p>
      </main>
    );
  }

  if (loading && !testSeries) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1a0f0a] via-[#2d1810] to-[#ff6b35]">
        <p className="text-white text-lg">Loading test series details...</p>
      </main>
    );
  }

  if (!testSeries && !loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1a0f0a] via-[#2d1810] to-[#ff6b35]">
        <div className="text-center">
          <p className="text-white text-lg mb-4">Test series not found</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-semibold transition-all"
          >
            Go Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  if (!testSeries) {
    return null;
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1a0f0a] via-[#2d1810] to-[#ff6b35]">
        <p className="text-white text-lg">Redirecting to login...</p>
      </main>
    );
  }

  const isFree = !testSeries.price || testSeries.price === 0;
  const displayName = user.displayName || user.email || "User";

  return (
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="bg-[#ff6b35] text-white px-4 md:px-8 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-2xl font-bold hover:text-yellow-200 transition-colors"
          >
            AcadXL
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm">Welcome, {displayName}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-white text-[#ff6b35] rounded hover:bg-yellow-50 transition-colors font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 bg-white">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 text-[#ff6b35] hover:text-yellow-400 flex items-center gap-2 transition-colors"
        >
          ← Back
        </button>

        {/* Test Series Card */}
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          <div className="p-6 md:p-8">
            {/* Status and Price */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex gap-2">
                <span className="bg-black text-white text-sm font-semibold px-4 py-2 rounded-full">
                  {isFree ? "FREE" : "PREMIUM"}
                </span>
                {!isFree && testSeries.price && (
                  <span className="bg-[#ff6b35] text-white text-sm font-semibold px-4 py-2 rounded-full">
                    ₹{testSeries.price.toLocaleString()}
                  </span>
                )}
                {isEnrolledInSeries && (
                  <span className="bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-full">
                    ENROLLED
                  </span>
                )}
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{testSeries.title}</h1>

            {/* Description */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">Description</h2>
              <DescriptionRenderer description={testSeries.description || ""} />
            </div>

            {/* Tests Included */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Tests Included ({testSeries.testIds?.length || 0})
              </h2>
              {tests.length === 0 ? (
                <p className="text-gray-600">No tests available in this series.</p>
              ) : (
                <div className="space-y-3">
                  {tests.map((test) => (
                    <div
                      key={test.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">{test.title}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          {test.durationMinutes && <span>⏱️ {test.durationMinutes} minutes</span>}
                          {test.questions && <span>📝 {test.questions.length} Questions</span>}
                        </div>
                        {test.description && (
                          <div className="text-sm text-gray-600 mt-2">
                            <DescriptionRenderer description={test.description} className="text-sm" />
                          </div>
                        )}
                      </div>
                      {isEnrolledInSeries && (() => {
                        const hasAttempted = testAttemptMap.has(test.id);
                        const result = testAttemptMap.get(test.id);
                        const percentage = result 
                          ? (result.totalMarksObtained / result.totalMarksPossible) * 100 
                          : 0;
                        
                        return hasAttempted ? (
                          <div className="flex flex-col items-end gap-2 ml-4">
                            <button
                              onClick={() => router.push(`/dashboard/tests/${test.id}/result/${result?.id}`)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
                            >
                              View Result
                            </button>
                            <span className="text-xs text-gray-500">
                              Score: {percentage.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => router.push(`/dashboard/tests/${test.id}`)}
                            className="px-4 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all ml-4"
                          >
                            Start Test
                          </button>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* What's Included */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What's Included</h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl mt-1">✓</span>
                  <span className="text-gray-700 text-lg">
                    {testSeries.testIds?.length || 0} comprehensive tests covering all topics
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl mt-1">✓</span>
                  <span className="text-gray-700 text-lg">
                    Detailed solutions and explanations for all questions
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl mt-1">✓</span>
                  <span className="text-gray-700 text-lg">
                    Performance tracking and analytics
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 text-xl mt-1">✓</span>
                  <span className="text-gray-700 text-lg">
                    24/7 access to all tests and materials
                  </span>
                </li>
                {!isFree && (
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl mt-1">✓</span>
                    <span className="text-gray-700 text-lg">
                      Priority support and doubt resolution
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            {!isEnrolledInSeries && (
              <div className="pt-6 border-t">
                <button
                  onClick={handleEnroll}
                  disabled={enrolling}
                  className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
                    isFree
                      ? "bg-[#ff6b35] hover:bg-yellow-400 text-white"
                      : "bg-yellow-400 hover:bg-yellow-300 text-gray-900"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {enrolling
                    ? "Enrolling..."
                    : isFree
                    ? "Enroll Free"
                    : "Purchase Now"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

