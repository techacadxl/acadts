// app/admin/students/[userId]/activity/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getUserDocument } from "@/lib/db/users";
import { getUserTestResults } from "@/lib/db/testResults";
import type { AppUser } from "@/lib/db/users";
import type { TestResult } from "@/lib/types/testResult";

export default function StudentActivityPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const userId = params?.userId as string;

  const [studentUser, setStudentUser] = useState<AppUser | null>(null);
  const [studentActivity, setStudentActivity] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || profileLoading || !userId) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load user details
        const userData = await getUserDocument(userId);
        if (!userData) {
          setError("Student not found.");
          setLoading(false);
          return;
        }
        setStudentUser(userData);

        // Load test results
        const results = await getUserTestResults(userId);
        
        // Sort by most recent first
        const sortedResults = results.sort((a, b) => {
          let aTime = 0;
          let bTime = 0;
          
          if (a.submittedAt) {
            if (typeof a.submittedAt.toMillis === "function") {
              aTime = a.submittedAt.toMillis();
            } else if (a.submittedAt.seconds) {
              aTime = a.submittedAt.seconds * 1000;
            } else if (a.submittedAt instanceof Date) {
              aTime = a.submittedAt.getTime();
            }
          }
          
          if (b.submittedAt) {
            if (typeof b.submittedAt.toMillis === "function") {
              bTime = b.submittedAt.toMillis();
            } else if (b.submittedAt.seconds) {
              bTime = b.submittedAt.seconds * 1000;
            } else if (b.submittedAt instanceof Date) {
              bTime = b.submittedAt.getTime();
            }
          }
          
          return bTime - aTime;
        });
        
        setStudentActivity(sortedResults);
      } catch (error) {
        console.error("[StudentActivityPage] Error loading data:", error);
        setError("Failed to load student activity. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, profileLoading, user, role, router, userId]);

  if (authLoading || profileLoading || loading) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading student activity...</p>
        </div>
      </div>
    );
  }

  if (!user || role !== "admin") {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    );
  }

  if (error || !studentUser) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-red-600 mb-4">{error || "Student not found."}</p>
            <button
              onClick={() => router.push("/admin/test-series")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Back to Test Series
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Go back"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Student Activity</h1>
              <p className="text-sm text-gray-600 mt-1">
                {studentUser.displayName || "Unknown"}
                {studentUser.email && ` • ${studentUser.email}`}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        {studentActivity.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-700 font-medium mb-1">Total Attempts</p>
              <p className="text-2xl font-bold text-blue-900">{studentActivity.length}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs text-green-700 font-medium mb-1">Average Score</p>
              <p className="text-2xl font-bold text-green-900">
                {studentActivity.length > 0
                  ? (
                      studentActivity.reduce((sum, result) => {
                        const percentage = (result.totalMarksObtained / result.totalMarksPossible) * 100;
                        return sum + percentage;
                      }, 0) / studentActivity.length
                    ).toFixed(1)
                  : "0.0"}
                %
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-xs text-purple-700 font-medium mb-1">Total Correct</p>
              <p className="text-2xl font-bold text-purple-900">
                {studentActivity.reduce((sum, result) => sum + result.correctAnswers, 0)}
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-xs text-orange-700 font-medium mb-1">Total Marks</p>
              <p className="text-2xl font-bold text-orange-900">
                {studentActivity.reduce((sum, result) => sum + result.totalMarksObtained, 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* Test Attempts Table */}
        {studentActivity.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 mb-2">No test attempts found for this student.</p>
            <p className="text-sm text-gray-500">Test attempts will appear here once the student completes tests.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Test Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Marks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Correct
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Incorrect
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Time Spent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {studentActivity.map((result) => {
                    const percentage = (result.totalMarksObtained / result.totalMarksPossible) * 100;
                    
                    // Handle Firestore Timestamp
                    let submittedDate: Date | null = null;
                    if (result.submittedAt) {
                      if (typeof result.submittedAt.toDate === "function") {
                        submittedDate = result.submittedAt.toDate();
                      } else if (result.submittedAt instanceof Date) {
                        submittedDate = result.submittedAt;
                      } else if (result.submittedAt.seconds) {
                        submittedDate = new Date(result.submittedAt.seconds * 1000);
                      } else if (typeof result.submittedAt.toMillis === "function") {
                        submittedDate = new Date(result.submittedAt.toMillis());
                      }
                    }
                    
                    const timeSpentMinutes = Math.floor(result.timeSpentSeconds / 60);
                    const timeSpentSeconds = result.timeSpentSeconds % 60;

                    return (
                      <tr key={result.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {result.testTitle}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {result.totalQuestions} Questions
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {submittedDate
                              ? submittedDate.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-lg font-bold ${
                                percentage >= 70
                                  ? "text-green-600"
                                  : percentage >= 50
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {result.totalMarksObtained.toFixed(2)} / {result.totalMarksPossible.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-green-600 font-medium">
                            {result.correctAnswers}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-red-600 font-medium">
                            {result.incorrectAnswers}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {timeSpentMinutes}m {timeSpentSeconds}s
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              router.push(`/dashboard/tests/${result.testId}/result/${result.id}`);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

