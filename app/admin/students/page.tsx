// app/admin/students/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getAllUsers } from "@/lib/db/users";
import { getUserEnrollments } from "@/lib/db/students";
import { getUserTestResults } from "@/lib/db/testResults";
import { cache } from "@/lib/utils/cache";
import Pagination from "@/components/Pagination";
import { TableSkeleton, CardSkeleton } from "@/components/LoadingSkeleton";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { AppUser } from "@/lib/db/users";
import type { EnrollmentWithSeries } from "@/lib/db/students";
import type { TestResult } from "@/lib/types/testResult";

interface StudentWithStats extends AppUser {
  enrollmentsCount: number;
  testAttemptsCount: number;
  lastActivity?: Date;
}

export default function AllStudentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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
        const allUsers = await getAllUsers();
        
        // Filter out admin users (only show students)
        const studentUsers = allUsers.filter((u) => u.role !== "admin");
        
        // Load stats for each student
        const studentsWithStats = await Promise.all(
          studentUsers.map(async (student) => {
            try {
              const [enrollments, testResults] = await Promise.all([
                getUserEnrollments(student.uid),
                getUserTestResults(student.uid),
              ]);

              // Find last activity date
              let lastActivity: Date | undefined;
              if (testResults.length > 0) {
                const lastResult = testResults.sort((a, b) => {
                  const aTime = a.submittedAt?.toMillis() || 0;
                  const bTime = b.submittedAt?.toMillis() || 0;
                  return bTime - aTime;
                })[0];
                if (lastResult.submittedAt) {
                  lastActivity = lastResult.submittedAt.toDate();
                }
              }

              return {
                ...student,
                enrollmentsCount: enrollments.length,
                testAttemptsCount: testResults.length,
                lastActivity,
              };
            } catch (err) {
              console.error(`[AllStudentsPage] Error loading stats for ${student.uid}:`, err);
              return {
                ...student,
                enrollmentsCount: 0,
                testAttemptsCount: 0,
              };
            }
          })
        );

        setStudents(studentsWithStats);
      } catch (err) {
        console.error("[AllStudentsPage] Error loading students:", err);
        setError("Failed to load students. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [authLoading, profileLoading, user, role, router]);

  const handleViewActivity = useCallback((userId: string) => {
    router.push(`/admin/students/${userId}/activity`);
  }, [router]);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        student.displayName?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query) ||
        student.phoneNumber?.toLowerCase().includes(query) ||
        student.uid.toLowerCase().includes(query)
      );
    });
  }, [students, searchQuery]);

  // Paginated students
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredStudents.slice(startIndex, endIndex);
  }, [filteredStudents, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredStudents.length / pageSize);
  }, [filteredStudents.length, pageSize]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (authLoading || profileLoading) {
    return <LoadingSpinner fullScreen text="Checking access..." />;
  }

  if (loading) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-6">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-96 bg-gray-200 rounded animate-pulse"></div>
          </div>
          
          {/* Search Skeleton */}
          <div className="mb-6 h-10 w-full max-w-md bg-gray-200 rounded animate-pulse"></div>
          
          {/* Summary Cards Skeleton */}
          <CardSkeleton count={3} />
          
          {/* Table Skeleton */}
          <div className="mt-6">
            <TableSkeleton rows={10} cols={8} />
          </div>
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

  if (error) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">All Students</h1>
          <p className="text-sm text-gray-600">View and manage all registered students</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, email, phone, or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Summary Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-blue-900">Total Students</p>
              <p className="text-2xl font-bold text-blue-700">{students.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Total Enrollments</p>
              <p className="text-2xl font-bold text-blue-700">
                {students.reduce((sum, s) => sum + s.enrollmentsCount, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Total Test Attempts</p>
              <p className="text-2xl font-bold text-blue-700">
                {students.reduce((sum, s) => sum + s.testAttemptsCount, 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Results Count and Page Size */}
        {filteredStudents.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {paginatedStudents.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Items per page:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        )}

        {/* Students Table */}
        {filteredStudents.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 mb-2">
              {searchQuery ? "No students found matching your search." : "No students registered yet."}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Enrollments
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Test Attempts
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Last Activity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedStudents.map((student, index) => {
                    let createdAtDate: Date | null = null;
                    if (student.createdAt) {
                      if (typeof student.createdAt.toDate === "function") {
                        createdAtDate = student.createdAt.toDate();
                      } else if (student.createdAt.seconds) {
                        createdAtDate = new Date(student.createdAt.seconds * 1000);
                      }
                    }

                    return (
                      <tr key={student.uid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {(currentPage - 1) * pageSize + index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {student.displayName || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {student.email || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {student.phoneNumber || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 text-center">
                            {student.enrollmentsCount}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 text-center">
                            {student.testAttemptsCount}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {student.lastActivity
                              ? student.lastActivity.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "Never"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleViewActivity(student.uid)}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                          >
                            View Activity
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

        {/* Pagination */}
        {filteredStudents.length > 0 && totalPages > 1 && (
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
    </div>
  );
}

