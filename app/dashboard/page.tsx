// app/dashboard/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useEffect, useCallback, useState, useMemo, memo } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getAvailableTestSeries, getUserEnrollments, enrollInTestSeries, isEnrolled } from "@/lib/db/students";
import type { TestSeries } from "@/lib/types/testSeries";
import type { EnrollmentWithSeries } from "@/lib/db/students";
import { getTestById } from "@/lib/db/tests";
import { getTestSeriesById } from "@/lib/db/testSeries";
import type { Test } from "@/lib/types/test";
import { getUserTestResults, getUserTestResult } from "@/lib/db/testResults";
import type { TestResult } from "@/lib/types/testResult";
import dynamic from "next/dynamic";
import { CardSkeleton, ListSkeleton } from "@/components/LoadingSkeleton";
import LoadingSpinner from "@/components/LoadingSpinner";

// Lazy load DescriptionRenderer for better performance
const DescriptionRenderer = dynamic(() => import("@/components/DescriptionRenderer"), {
  loading: () => <span className="text-sm text-gray-600">Loading...</span>,
});

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [availableSeries, setAvailableSeries] = useState<TestSeries[]>([]);
  const [enrolledSeries, setEnrolledSeries] = useState<EnrollmentWithSeries[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"available" | "enrolled" | "attempts" | "reports">("available");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [seriesTests, setSeriesTests] = useState<Test[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [testAttemptMap, setTestAttemptMap] = useState<Map<string, TestResult>>(new Map());

  // All hooks must be called before any early returns
  const handleLogout = useCallback(async () => {
    if (!user) return;
    console.log("[DashboardPage] Logout initiated:", user.uid);
    try {
      // Clear login time
      if (typeof window !== "undefined") {
        localStorage.removeItem("user_login_time");
      }
      await signOut(auth);
      console.log("[DashboardPage] Sign out successful, redirecting");
      router.replace("/");
    } catch (err) {
      console.error("[DashboardPage] Logout error:", err);
    }
  }, [user, router]);

  // Load test series and results
  useEffect(() => {
    if (!user || authLoading || profileLoading) return;

    const loadData = async () => {
      setLoadingSeries(true);
      setLoadingResults(true);
      try {
        const [available, enrolled, results] = await Promise.all([
          getAvailableTestSeries(),
          getUserEnrollments(user.uid),
          getUserTestResults(user.uid),
        ]);
        
        // Filter out enrolled series from available list
        const enrolledIds = new Set(enrolled.map((e) => e.testSeriesId));
        const notEnrolled = available.filter((series) => !enrolledIds.has(series.id));
        
        setAvailableSeries(notEnrolled);
        setEnrolledSeries(enrolled);
        setTestResults(results);
        
        // Create a map of testId -> TestResult for quick lookup (memoized)
        const attemptMap = new Map<string, TestResult>();
        results.forEach((result) => {
          attemptMap.set(result.testId, result);
        });
        setTestAttemptMap(attemptMap);
      } catch (error) {
        console.error("[DashboardPage] Error loading data:", error);
      } finally {
        setLoadingSeries(false);
        setLoadingResults(false);
      }
    };

    loadData();
  }, [user, authLoading, profileLoading]);

  // Load tests for selected series
  useEffect(() => {
    if (!selectedSeriesId || !user) return;

    const loadTests = async () => {
      setLoadingTests(true);
      try {
        // Fetch fresh test series data instead of using cached enrollment data
        // This ensures students see newly added tests immediately
        // Bypass cache to get the latest data
        const freshTestSeries = await getTestSeriesById(selectedSeriesId, true);
        
        console.log("[DashboardPage] Loaded test series:", {
          id: selectedSeriesId,
          title: freshTestSeries?.title,
          testIds: freshTestSeries?.testIds,
          testIdsLength: freshTestSeries?.testIds?.length,
        });
        
        if (!freshTestSeries?.testIds || freshTestSeries.testIds.length === 0) {
          console.warn("[DashboardPage] No testIds found in test series:", selectedSeriesId);
          setSeriesTests([]);
          return;
        }

        console.log("[DashboardPage] Loading tests for IDs:", freshTestSeries.testIds);
        const tests = await Promise.all(
          freshTestSeries.testIds.map(async (testId) => {
            try {
              const test = await getTestById(testId);
              if (!test) {
                console.warn("[DashboardPage] Test not found for ID:", testId);
              }
              return test;
            } catch (err) {
              console.error("[DashboardPage] Error loading test:", testId, err);
              return null;
            }
          })
        );
        
        const validTests = tests.filter((t): t is Test => t !== null);
        console.log("[DashboardPage] Loaded tests:", {
          total: tests.length,
          valid: validTests.length,
          testTitles: validTests.map(t => t.title),
        });
        
        setSeriesTests(validTests);
      } catch (error) {
        console.error("[DashboardPage] Error loading tests:", error);
        setSeriesTests([]);
      } finally {
        setLoadingTests(false);
      }
    };

    loadTests();
  }, [selectedSeriesId, user]);

  // Redirect admins to admin panel
  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (user && role === "admin") {
      router.replace("/admin");
    }
  }, [authLoading, profileLoading, user, role, router]);

  const handleEnroll = useCallback(async (testSeriesId: string) => {
    if (!user) return;
    setEnrollingId(testSeriesId);
    try {
      // Get series info before optimistic update
      const series = availableSeries.find((s) => s.id === testSeriesId);
      const isFree = !series?.price || series.price === 0;
      
      await enrollInTestSeries(user.uid, testSeriesId);
      
      // Optimistic update - update UI immediately
      if (series) {
        // Remove from available list immediately
        setAvailableSeries((prev) => prev.filter((s) => s.id !== testSeriesId));
        // Add to enrolled list optimistically
        setEnrolledSeries((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            userId: user.uid,
            testSeriesId: series.id,
            enrolledAt: { toDate: () => new Date() } as any,
            status: "active" as const,
            testSeries: series,
          },
        ]);
      }
      
      // Reload enrollments in background to ensure consistency
      const updated = await getUserEnrollments(user.uid);
      setEnrolledSeries(updated);
      
      // Show success message
      alert(
        isFree
          ? "Successfully enrolled in test series! You now have access to all tests."
          : "Purchase successful! You now have access to all tests in this series."
      );
    } catch (error) {
      console.error("[DashboardPage] Error enrolling:", error);
      alert("Failed to enroll. Please try again.");
    } finally {
      setEnrollingId(null);
    }
  }, [user, availableSeries]);


  // Wait for BOTH auth + role to load
  if (authLoading || profileLoading) {
    return <LoadingSpinner fullScreen text="Checking session..." />;
  }

  if (!user) {
    if (typeof window !== "undefined") {
      router.replace("/login");
    }
    return <LoadingSpinner fullScreen text="Redirecting..." />;
  }

  const displayName = user.displayName || user.email || "User";

  return (
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="bg-[#ff6b35] text-white px-4 md:px-8 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-bold">AcadXL</div>
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

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 bg-white">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b-2 border-gray-300">
          <button
            onClick={() => {
              setActiveTab("available");
              setSelectedSeriesId(null);
            }}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "available"
                ? "text-[#ff6b35] border-b-2 border-[#ff6b35]"
                : "text-gray-600 hover:text-[#ff6b35]"
            }`}
          >
            Available Test Series
          </button>
          <button
            onClick={() => {
              setActiveTab("enrolled");
              setSelectedSeriesId(null);
            }}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "enrolled"
                ? "text-[#ff6b35] border-b-2 border-[#ff6b35]"
                : "text-gray-600 hover:text-[#ff6b35]"
            }`}
          >
            My Enrolled Series ({enrolledSeries.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("attempts");
              setSelectedSeriesId(null);
            }}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "attempts"
                ? "text-[#ff6b35] border-b-2 border-[#ff6b35]"
                : "text-gray-600 hover:text-[#ff6b35]"
            }`}
          >
            My Attempts ({testResults.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("reports");
              setSelectedSeriesId(null);
            }}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === "reports"
                ? "text-[#ff6b35] border-b-2 border-[#ff6b35]"
                : "text-gray-600 hover:text-[#ff6b35]"
            }`}
          >
            Reports
          </button>
        </div>

        {/* Available Test Series */}
        {activeTab === "available" && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Available Test Series</h2>
            {loadingSeries ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-xl overflow-hidden">
                    <div className="p-6">
                      <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4"></div>
                      <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2"></div>
                      <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-4"></div>
                      <div className="h-10 w-full bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : availableSeries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">No test series available at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableSeries.map((series) => {
                  const isFree = !series.price || series.price === 0;
                  const isEnrolling = enrollingId === series.id;
                  
                  return (
                    <div
                      key={series.id}
                      className="bg-white rounded-lg shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:scale-105"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <span className="bg-black text-white text-xs font-semibold px-3 py-1 rounded-full">
                            {isFree ? "FREE" : "PREMIUM"}
                          </span>
                          {!isFree && series.price && (
                            <span className="bg-[#ff6b35] text-white text-xs font-semibold px-3 py-1 rounded-full">
                              ₹{series.price.toLocaleString()}
                            </span>
                          )}
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 mb-2">{series.title}</h3>
                        <div className="text-sm text-gray-600 mb-4 line-clamp-2 overflow-hidden">
                          <DescriptionRenderer description={series.description || ""} className="text-sm" />
                        </div>

                        <div className="mb-4">
                          <p className="text-xs text-gray-500">
                            {series.testIds?.length || 0} Tests included
                          </p>
                        </div>

                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEnroll(series.id);
                            }}
                            disabled={isEnrolling}
                            className={`w-full py-2 rounded-lg font-semibold transition-all ${
                              isFree
                                ? "bg-[#ff6b35] hover:bg-yellow-400 text-white"
                                : "bg-yellow-400 hover:bg-yellow-300 text-gray-900"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isEnrolling
                              ? "Enrolling..."
                              : isFree
                              ? "Enroll Free"
                              : "Purchase"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log("[DashboardPage] Know More clicked for series:", series.id, series.title);
                              if (series.id) {
                                const route = `/dashboard/test-series/${series.id}`;
                                console.log("[DashboardPage] Navigating to:", route);
                                router.push(route);
                              } else {
                                console.error("[DashboardPage] Series ID is missing");
                                alert("Error: Test series ID not found");
                              }
                            }}
                            className="w-full text-blue-600 hover:text-blue-800 text-sm font-medium py-1 cursor-pointer"
                          >
                            Know More →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Enrolled Test Series */}
        {activeTab === "enrolled" && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">My Enrolled Test Series</h2>
            {loadingSeries ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">Loading...</p>
              </div>
            ) : enrolledSeries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">You haven't enrolled in any test series yet.</p>
                <button
                  onClick={() => setActiveTab("available")}
                  className="mt-4 px-6 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-semibold transition-all"
                >
                  Browse Available Series
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {enrolledSeries.map((enrollment) => {
                  const series = enrollment.testSeries;
                  if (!series) return null;

                  const isSelected = selectedSeriesId === series.id;

                  return (
                    <div
                      key={enrollment.id}
                      className="bg-white rounded-lg shadow-xl overflow-hidden"
                    >
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">{series.title}</h3>
                            <div className="text-sm text-gray-600 mb-4">
                              <DescriptionRenderer description={series.description || ""} className="text-sm" />
                            </div>
                            <p className="text-xs text-gray-500">
                              Enrolled • {series.testIds?.length || 0} Tests Available
                            </p>
                          </div>
                          <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                            ENROLLED
                          </span>
                        </div>

                        <button
                          onClick={() => setSelectedSeriesId(isSelected ? null : series.id)}
                          className="w-full bg-[#ff6b35] hover:bg-yellow-400 text-white py-2 rounded-lg font-semibold transition-all"
                        >
                          {isSelected ? "Hide Tests" : "View Tests"}
                        </button>

                        {/* Tests List */}
                        {isSelected && (
                          <div className="mt-6 pt-6 border-t border-gray-200">
                            {loadingTests ? (
                              <div className="space-y-3">
                                {Array.from({ length: 3 }).map((_, i) => (
                                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div className="flex-1">
                                      <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
                                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                                    </div>
                                    <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
                                  </div>
                                ))}
                              </div>
                            ) : seriesTests.length === 0 ? (
                              <p className="text-center text-gray-600 py-4">No tests available in this series.</p>
                            ) : (
                              <div className="space-y-3">
                                {seriesTests.map((test) => {
                                  const hasAttempted = testAttemptMap.has(test.id);
                                  const result = testAttemptMap.get(test.id);
                                  const percentage = result 
                                    ? (result.totalMarksObtained / result.totalMarksPossible) * 100 
                                    : 0;
                                  
                                  return (
                                    <div
                                      key={test.id}
                                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                      <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900">{test.title}</h4>
                                        <p className="text-sm text-gray-600">
                                          {test.durationMinutes} min • {test.questions?.length || 0} Questions
                                        </p>
                                        {hasAttempted && result && (
                                          <p className="text-xs text-gray-500 mt-1">
                                            Attempted • Score: {result.totalMarksObtained.toFixed(2)}/{result.totalMarksPossible.toFixed(2)} ({percentage.toFixed(1)}%)
                                          </p>
                                        )}
                                      </div>
                                      {hasAttempted ? (
                                        <button
                                          onClick={() => router.push(`/dashboard/tests/${test.id}/result/${result?.id}`)}
                                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all"
                                        >
                                          View Result
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => router.push(`/dashboard/tests/${test.id}`)}
                                          className="px-4 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all"
                                        >
                                          Start Test
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* My Attempts Tab */}
        {activeTab === "attempts" && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">My Test Attempts</h2>
            {loadingResults ? (
              <ListSkeleton items={5} />
            ) : testResults.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">You haven't attempted any tests yet.</p>
                <button
                  onClick={() => setActiveTab("enrolled")}
                  className="mt-4 px-6 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-semibold transition-all"
                >
                  View Enrolled Series
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {testResults
                  .sort((a, b) => {
                    const aTime = a.submittedAt?.toMillis() || 0;
                    const bTime = b.submittedAt?.toMillis() || 0;
                    return bTime - aTime; // Most recent first
                  })
                  .map((result) => {
                    const percentage = (result.totalMarksObtained / result.totalMarksPossible) * 100;
                    const submittedDate = result.submittedAt?.toDate();
                    const formattedDate = submittedDate
                      ? submittedDate.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Unknown date";
                    
                    return (
                      <div
                        key={result.id}
                        className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{result.testTitle}</h3>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                              <span>Submitted: {formattedDate}</span>
                              <span>•</span>
                              <span>Duration: {Math.floor(result.timeSpentSeconds / 60)} min</span>
                              <span>•</span>
                              <span>{result.totalQuestions} Questions</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${
                              percentage >= 70 ? "text-green-600" :
                              percentage >= 50 ? "text-yellow-600" :
                              "text-red-600"
                            }`}>
                              {percentage.toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-500">
                              {result.totalMarksObtained.toFixed(2)} / {result.totalMarksPossible.toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {/* Statistics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="bg-green-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">Correct</div>
                            <div className="text-lg font-bold text-green-700">{result.correctAnswers}</div>
                          </div>
                          <div className="bg-red-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">Incorrect</div>
                            <div className="text-lg font-bold text-red-700">{result.incorrectAnswers}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">Not Answered</div>
                            <div className="text-lg font-bold text-gray-700">{result.notAnswered}</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="text-xs text-gray-600 mb-1">Answered</div>
                            <div className="text-lg font-bold text-blue-700">{result.answeredQuestions}</div>
                          </div>
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => router.push(`/dashboard/tests/${result.testId}/result/${result.id}`)}
                          className="w-full px-4 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all"
                        >
                          View Detailed Result
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === "reports" && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Reports & Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Combined Report Card */}
              <div
                onClick={() => router.push("/dashboard/reports/combined")}
                className="bg-white rounded-lg shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:scale-105 cursor-pointer border-2 border-[#ff6b35]"
              >
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl">📊</div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Combined Report</h3>
                      <p className="text-sm text-gray-600">Overall progress across all tests</p>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 mb-4">
                    <li className="flex items-center gap-2">
                      <span className="text-[#ff6b35]">✓</span>
                      Overall performance trends
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#ff6b35]">✓</span>
                      Subject-wise analysis
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#ff6b35]">✓</span>
                      Accuracy & speed insights
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#ff6b35]">✓</span>
                      Strengths & weaknesses
                    </li>
                  </ul>
                  <button className="w-full bg-[#ff6b35] hover:bg-yellow-400 text-white py-2 rounded-lg font-semibold transition-all">
                    View Combined Report →
                  </button>
                </div>
              </div>

              {/* Test-wise Report Card */}
              <div
                onClick={() => router.push("/dashboard/reports/testwise")}
                className="bg-white rounded-lg shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:scale-105 cursor-pointer border-2 border-[#ff6b35]"
              >
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl">📈</div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Test-wise Report</h3>
                      <p className="text-sm text-gray-600">Detailed analysis for each test</p>
                    </div>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 mb-4">
                    <li className="flex items-center gap-2">
                      <span className="text-[#ff6b35]">✓</span>
                      Individual test performance
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#ff6b35]">✓</span>
                      Topic-wise breakdown
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#ff6b35]">✓</span>
                      Question-level analysis
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#ff6b35]">✓</span>
                      Improvement suggestions
                    </li>
                  </ul>
                  <button className="w-full bg-[#ff6b35] hover:bg-yellow-400 text-white py-2 rounded-lg font-semibold transition-all">
                    View Test-wise Report →
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#ff6b35]">{testResults.length}</p>
                  <p className="text-sm text-gray-600">Total Attempts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {testResults.length > 0
                      ? Math.round(
                          (testResults.filter(
                            (r) => (r.totalMarksObtained / r.totalMarksPossible) * 100 >= 70
                          ).length /
                            testResults.length) *
                            100
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-sm text-gray-600">Above 70%</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {testResults.length > 0
                      ? (
                          testResults.reduce(
                            (sum, r) => sum + (r.totalMarksObtained / r.totalMarksPossible) * 100,
                            0
                          ) / testResults.length
                        ).toFixed(1)
                      : "0"}
                    %
                  </p>
                  <p className="text-sm text-gray-600">Average Score</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{enrolledSeries.length}</p>
                  <p className="text-sm text-gray-600">Enrolled Series</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </main>
  );
}
