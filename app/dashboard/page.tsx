// app/dashboard/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { useEffect, useCallback, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getAvailableTestSeries, getUserEnrollments, enrollInTestSeries, isEnrolled } from "@/lib/db/students";
import type { TestSeries } from "@/lib/types/testSeries";
import type { EnrollmentWithSeries } from "@/lib/db/students";
import { getTestById } from "@/lib/db/tests";
import type { Test } from "@/lib/types/test";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [availableSeries, setAvailableSeries] = useState<TestSeries[]>([]);
  const [enrolledSeries, setEnrolledSeries] = useState<EnrollmentWithSeries[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"available" | "enrolled">("available");
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [seriesTests, setSeriesTests] = useState<Test[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);

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
      router.replace("/login");
    } catch (err) {
      console.error("[DashboardPage] Logout error:", err);
    }
  }, [user, router]);

  // Load test series
  useEffect(() => {
    if (!user || authLoading || profileLoading) return;

    const loadData = async () => {
      setLoadingSeries(true);
      try {
        const [available, enrolled] = await Promise.all([
          getAvailableTestSeries(),
          getUserEnrollments(user.uid),
        ]);
        
        // Filter out enrolled series from available list
        const enrolledIds = new Set(enrolled.map((e) => e.testSeriesId));
        const notEnrolled = available.filter((series) => !enrolledIds.has(series.id));
        
        setAvailableSeries(notEnrolled);
        setEnrolledSeries(enrolled);
      } catch (error) {
        console.error("[DashboardPage] Error loading test series:", error);
      } finally {
        setLoadingSeries(false);
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
        const enrollment = enrolledSeries.find((e) => e.testSeriesId === selectedSeriesId);
        if (!enrollment?.testSeries?.testIds) {
          setSeriesTests([]);
          return;
        }

        const tests = await Promise.all(
          enrollment.testSeries.testIds.map(async (testId) => {
            const test = await getTestById(testId);
            return test;
          })
        );
        setSeriesTests(tests.filter((t): t is Test => t !== null));
      } catch (error) {
        console.error("[DashboardPage] Error loading tests:", error);
      } finally {
        setLoadingTests(false);
      }
    };

    loadTests();
  }, [selectedSeriesId, enrolledSeries]);

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
      await enrollInTestSeries(user.uid, testSeriesId);
      // Reload enrollments
      const updated = await getUserEnrollments(user.uid);
      setEnrolledSeries(updated);
      // Remove from available list (whether free or paid)
      setAvailableSeries((prev) => prev.filter((s) => s.id !== testSeriesId));
    } catch (error) {
      console.error("[DashboardPage] Error enrolling:", error);
      alert("Failed to enroll. Please try again.");
    } finally {
      setEnrollingId(null);
    }
  }, [user]);


  // Wait for BOTH auth + role to load
  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-900 text-lg">Checking session...</p>
      </main>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") {
      router.replace("/login");
    }
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-900 text-lg">Redirecting...</p>
      </main>
    );
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
        </div>

        {/* Available Test Series */}
        {activeTab === "available" && (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Available Test Series</h2>
            {loadingSeries ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg">Loading test series...</p>
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
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{series.description}</p>

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
                            <p className="text-sm text-gray-600 mb-4">{series.description}</p>
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
                              <p className="text-center text-gray-600 py-4">Loading tests...</p>
                            ) : seriesTests.length === 0 ? (
                              <p className="text-center text-gray-600 py-4">No tests available in this series.</p>
                            ) : (
                              <div className="space-y-3">
                                {seriesTests.map((test) => (
                                  <div
                                    key={test.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                  >
                                    <div>
                                      <h4 className="font-semibold text-gray-900">{test.title}</h4>
                                      <p className="text-sm text-gray-600">
                                        {test.durationMinutes} min • {test.questions?.length || 0} Questions
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => router.push(`/dashboard/tests/${test.id}`)}
                                      className="px-4 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all"
                                    >
                                      Start Test
                                    </button>
                                  </div>
                                ))}
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
      </div>

    </main>
  );
}
