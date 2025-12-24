// app/admin/test-series/[id]/students/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getTestSeriesById } from "@/lib/db/testSeries";
import { getTestSeriesEnrollments } from "@/lib/db/students";
import { getUserDocuments } from "@/lib/db/users";
import type { TestSeries } from "@/lib/types/testSeries";
import type { Enrollment } from "@/lib/db/students";
import type { AppUser } from "@/lib/db/users";

export default function TestSeriesStudentsPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const testSeriesId = params?.id as string;

  const [testSeries, setTestSeries] = useState<TestSeries | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<Array<{ enrollment: Enrollment; user: AppUser | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || profileLoading || !testSeriesId) return;

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
        // Load test series details
        const series = await getTestSeriesById(testSeriesId);
        if (!series) {
          setError("Test series not found.");
          setLoading(false);
          return;
        }
        setTestSeries(series);

        // Load enrollments
        const enrollments = await getTestSeriesEnrollments(testSeriesId);
        
        if (enrollments.length === 0) {
          setEnrolledStudents([]);
          setLoading(false);
          return;
        }

        // Get user IDs from enrollments
        const userIds = enrollments.map((e) => e.userId);
        
        // Fetch user details
        const userMap = await getUserDocuments(userIds);

        // Combine enrollment and user data
        const studentsData = enrollments.map((enrollment) => ({
          enrollment,
          user: userMap.get(enrollment.userId) || null,
        }));

        setEnrolledStudents(studentsData);
      } catch (error) {
        console.error("[TestSeriesStudentsPage] Error loading data:", error);
        setError("Failed to load enrolled students. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, profileLoading, user, role, router, testSeriesId]);

  const handleViewStudentActivity = useCallback((userId: string) => {
    router.push(`/admin/students/${userId}/activity`);
  }, [router]);

  if (authLoading || profileLoading || loading) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading enrolled students...</p>
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

  if (error || !testSeries) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-red-600 mb-4">{error || "Test series not found."}</p>
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
              onClick={() => router.push("/admin/test-series")}
              className="text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Back to test series"
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
              <h1 className="text-2xl font-semibold text-gray-900">Enrolled Students</h1>
              <p className="text-sm text-gray-600 mt-1">{testSeries.title}</p>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm font-medium text-blue-900">
            Total Enrolled: <span className="font-bold">{enrolledStudents.length}</span> student{enrolledStudents.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Students Table */}
        {enrolledStudents.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 mb-2">No students enrolled in this test series yet.</p>
            <p className="text-sm text-gray-500">Students will appear here once they enroll.</p>
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
                      User ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Enrolled Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {enrolledStudents.map((item, index) => {
                    const enrollment = item.enrollment;
                    const user = item.user;
                    
                    // Handle Firestore Timestamp
                    let enrolledDate: Date | null = null;
                    if (enrollment.enrolledAt) {
                      if (typeof enrollment.enrolledAt.toDate === "function") {
                        enrolledDate = enrollment.enrolledAt.toDate();
                      } else if (enrollment.enrolledAt instanceof Date) {
                        enrolledDate = enrollment.enrolledAt;
                      } else if (enrollment.enrolledAt.seconds) {
                        enrolledDate = new Date(enrollment.enrolledAt.seconds * 1000);
                      }
                    }

                    return (
                      <tr key={enrollment.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {user?.displayName || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {user?.email || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-500 font-mono">
                            {enrollment.userId}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">
                            {enrolledDate
                              ? enrolledDate.toLocaleDateString("en-US", {
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
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              enrollment.status === "active"
                                ? "bg-green-100 text-green-800"
                                : enrollment.status === "expired"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleViewStudentActivity(enrollment.userId)}
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
      </div>
    </div>
  );
}







