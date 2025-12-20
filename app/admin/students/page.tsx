// app/admin/students/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getAllStudents } from "@/lib/db/users";
import { getUserEnrollments } from "@/lib/db/students";
import { getUserTestResults } from "@/lib/db/testResults";
import type { AppUser } from "@/lib/db/users";
import type { EnrollmentWithSeries } from "@/lib/db/students";
import type { TestResult } from "@/lib/types/testResult";

interface StudentWithDetails extends AppUser {
  enrollments: EnrollmentWithSeries[];
  testResults: TestResult[];
  totalAttempts: number;
  averageScore: number;
}

export default function AllStudentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();

  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // Filter students based on search query
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) {
      return students;
    }

    const query = searchQuery.toLowerCase().trim();
    return students.filter((student) => {
      const name = (student.displayName || "").toLowerCase();
      const email = (student.email || "").toLowerCase();
      const uid = student.uid.toLowerCase();
      
      return name.includes(query) || email.includes(query) || uid.includes(query);
    });
  }, [students, searchQuery]);

  useEffect(() => {
    setFilteredStudents(filtered);
  }, [filtered]);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    const loadStudents = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get all students
        const allStudents = await getAllStudents();
        
        if (allStudents.length === 0) {
          setStudents([]);
          setLoading(false);
          return;
        }

        // Load enrollments and test results for each student in parallel
        const studentsWithDetails: StudentWithDetails[] = await Promise.all(
          allStudents.map(async (student) => {
            try {
              // Fetch enrollments and test results in parallel
              const [enrollments, testResults] = await Promise.all([
                getUserEnrollments(student.uid),
                getUserTestResults(student.uid),
              ]);

              // Calculate statistics
              const totalAttempts = testResults.length;
              const averageScore =
                totalAttempts > 0
                  ? testResults.reduce((sum, result) => {
                      const percentage =
                        (result.totalMarksObtained / result.totalMarksPossible) * 100;
                      return sum + percentage;
                    }, 0) / totalAttempts
                  : 0;

              return {
                ...student,
                enrollments,
                testResults,
                totalAttempts,
                averageScore,
              };
            } catch (err) {
              console.error(
                `[AllStudentsPage] Error loading details for student ${student.uid}:`,
                err
              );
              // Return student with empty data on error
              return {
                ...student,
                enrollments: [],
                testResults: [],
                totalAttempts: 0,
                averageScore: 0,
              };
            }
          })
        );

        // Sort by name (or email if no name)
        studentsWithDetails.sort((a, b) => {
          const aName = a.displayName || a.email || "";
          const bName = b.displayName || b.email || "";
          return aName.localeCompare(bName);
        });

        setStudents(studentsWithDetails);
      } catch (error) {
        console.error("[AllStudentsPage] Error loading students:", error);
        setError("Failed to load students. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [authLoading, profileLoading, user, role, router]);

  const handleViewActivity = useCallback(
    (userId: string) => {
      router.push(`/admin/students/${userId}/activity`);
    },
    [router]
  );

  const toggleExpand = useCallback((userId: string) => {
    setExpandedStudent((prev) => (prev === userId ? null : userId));
  }, []);

  if (authLoading || profileLoading || loading) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading students...</p>
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

  return (
    <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All Students</h1>
          <p className="text-sm text-gray-600">
            View and manage all students on the platform
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLineJoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, email, or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-600">
              Found {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Students List */}
        {filteredStudents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLineJoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? "No students found" : "No students yet"}
            </p>
            <p className="text-sm text-gray-500">
              {searchQuery
                ? "Try adjusting your search query"
                : "Students will appear here once they register"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStudents.map((student) => (
              <div
                key={student.uid}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all overflow-hidden"
              >
                {/* Student Card Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    {/* Left: Student Info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 font-semibold text-lg">
                          {(student.displayName || student.email || "U")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {student.displayName || "Unnamed Student"}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">{student.email || "No email"}</p>
                        <p className="text-xs text-gray-500 font-mono">ID: {student.uid}</p>
                      </div>
                    </div>

                    {/* Right: Stats & Actions */}
                    <div className="flex items-center gap-4">
                      {/* Quick Stats */}
                      <div className="hidden md:flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-sm font-semibold text-gray-900">
                            {student.enrollments.length}
                          </div>
                          <div className="text-xs text-gray-500">Enrolled</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold text-gray-900">
                            {student.totalAttempts}
                          </div>
                          <div className="text-xs text-gray-500">Attempts</div>
                        </div>
                        {student.totalAttempts > 0 && (
                          <div className="text-center">
                            <div className="text-sm font-semibold text-green-600">
                              {student.averageScore.toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-500">Avg Score</div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExpand(student.uid)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${
                              expandedStudent === student.uid ? "rotate-180" : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLineJoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                          {expandedStudent === student.uid ? "Less" : "More"}
                        </button>
                        <button
                          onClick={() => handleViewActivity(student.uid)}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLineJoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLineJoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          View Activity
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Stats */}
                  <div className="md:hidden mt-4 pt-4 border-t border-gray-200 flex items-center justify-around">
                    <div className="text-center">
                      <div className="text-sm font-semibold text-gray-900">
                        {student.enrollments.length}
                      </div>
                      <div className="text-xs text-gray-500">Enrolled</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-gray-900">
                        {student.totalAttempts}
                      </div>
                      <div className="text-xs text-gray-500">Attempts</div>
                    </div>
                    {student.totalAttempts > 0 && (
                      <div className="text-center">
                        <div className="text-sm font-semibold text-green-600">
                          {student.averageScore.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-500">Avg Score</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedStudent === student.uid && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {/* Enrolled Test Series */}
                    <div className="p-6">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLineJoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.747 5.754 19 7.5 19s3.332-.253 4.5-1m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.747 18.247 19 16.5 19c-1.746 0-3.332-.253-4.5-1"
                          />
                        </svg>
                        Enrolled Test Series ({student.enrollments.length})
                      </h4>
                      {student.enrollments.length === 0 ? (
                        <p className="text-sm text-gray-500 pl-7">
                          No test series enrolled yet
                        </p>
                      ) : (
                        <div className="space-y-2 pl-7">
                          {student.enrollments.map((enrollment) => (
                            <div
                              key={enrollment.id}
                              className="bg-white rounded-lg p-3 border border-gray-200"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">
                                    {enrollment.testSeries?.title || "Unknown Series"}
                                  </p>
                                  {enrollment.testSeries?.description && (
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                      {enrollment.testSeries.description}
                                    </p>
                                  )}
                                </div>
                                <div className="ml-4 text-right">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    {enrollment.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Test Attempts */}
                    <div className="p-6 pt-0">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <svg
                          className="w-5 h-5 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLineJoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Recent Test Attempts ({student.testResults.length})
                      </h4>
                      {student.testResults.length === 0 ? (
                        <p className="text-sm text-gray-500 pl-7">
                          No test attempts yet
                        </p>
                      ) : (
                        <div className="space-y-2 pl-7">
                          {student.testResults
                            .sort((a, b) => {
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
                            })
                            .slice(0, 5)
                            .map((result) => {
                              const percentage =
                                (result.totalMarksObtained / result.totalMarksPossible) * 100;
                              return (
                                <div
                                  key={result.id}
                                  className="bg-white rounded-lg p-3 border border-gray-200"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900">
                                        {result.testTitle}
                                      </p>
                                      <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-gray-500">
                                          {result.correctAnswers} correct, {result.incorrectAnswers}{" "}
                                          incorrect
                                        </span>
                                      </div>
                                    </div>
                                    <div className="ml-4 text-right">
                                      <div
                                        className={`text-sm font-semibold ${
                                          percentage >= 70
                                            ? "text-green-600"
                                            : percentage >= 50
                                            ? "text-yellow-600"
                                            : "text-red-600"
                                        }`}
                                      >
                                        {percentage.toFixed(1)}%
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {result.totalMarksObtained.toFixed(1)} /{" "}
                                        {result.totalMarksPossible.toFixed(1)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          {student.testResults.length > 5 && (
                            <button
                              onClick={() => handleViewActivity(student.uid)}
                              className="text-sm text-blue-600 hover:text-blue-700 font-medium pl-7"
                            >
                              View all {student.testResults.length} attempts →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

