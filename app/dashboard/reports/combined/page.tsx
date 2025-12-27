// app/dashboard/reports/combined/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getUserTestResults } from "@/lib/db/testResults";
import { getTestById } from "@/lib/db/tests";
import type { TestResult } from "@/lib/types/testResult";
import type { Test } from "@/lib/types/test";

interface SubjectStats {
  subject: string;
  totalTests: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  notAnswered: number;
  averageScore: number;
  totalMarksObtained: number;
  totalMarksPossible: number;
}

export default function CombinedReportPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [tests, setTests] = useState<Map<string, Test>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const results = await getUserTestResults(user.uid);
        setTestResults(results);

        // Load test details for all results
        const testIds = [...new Set(results.map((r) => r.testId))];
        const testMap = new Map<string, Test>();
        
        await Promise.all(
          testIds.map(async (testId) => {
            const test = await getTestById(testId);
            if (test) {
              testMap.set(testId, test);
            }
          })
        );
        
        setTests(testMap);
      } catch (error) {
        console.error("[CombinedReportPage] Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, authLoading, profileLoading, router]);

  // Calculate subject-wise statistics
  const subjectStats = useMemo(() => {
    const statsMap = new Map<string, SubjectStats>();

    testResults.forEach((result) => {
      const test = tests.get(result.testId);
      if (!test) return;

      const subject = test.subject || "Other";
      const existing = statsMap.get(subject) || {
        subject,
        totalTests: 0,
        totalQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        notAnswered: 0,
        totalMarksObtained: 0,
        totalMarksPossible: 0,
        averageScore: 0,
      };

      existing.totalTests += 1;
      existing.totalQuestions += result.totalQuestions;
      existing.correctAnswers += result.correctAnswers;
      existing.incorrectAnswers += result.incorrectAnswers;
      existing.notAnswered += result.notAnswered;
      existing.totalMarksObtained += result.totalMarksObtained;
      existing.totalMarksPossible += result.totalMarksPossible;

      statsMap.set(subject, existing);
    });

    // Calculate averages
    const statsArray = Array.from(statsMap.values()).map((stat) => ({
      ...stat,
      averageScore:
        stat.totalMarksPossible > 0
          ? (stat.totalMarksObtained / stat.totalMarksPossible) * 100
          : 0,
    }));

    return statsArray.sort((a, b) => b.averageScore - a.averageScore);
  }, [testResults, tests]);

  // Overall statistics
  const overallStats = useMemo(() => {
    if (testResults.length === 0) {
      return {
        totalTests: 0,
        totalQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        notAnswered: 0,
        averageScore: 0,
        totalMarksObtained: 0,
        totalMarksPossible: 0,
        accuracy: 0,
      };
    }

    const total = testResults.reduce(
      (acc, result) => {
        acc.totalQuestions += result.totalQuestions;
        acc.correctAnswers += result.correctAnswers;
        acc.incorrectAnswers += result.incorrectAnswers;
        acc.notAnswered += result.notAnswered;
        acc.totalMarksObtained += result.totalMarksObtained;
        acc.totalMarksPossible += result.totalMarksPossible;
        return acc;
      },
      {
        totalQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        notAnswered: 0,
        totalMarksObtained: 0,
        totalMarksPossible: 0,
      }
    );

    const averageScore =
      total.totalMarksPossible > 0
        ? (total.totalMarksObtained / total.totalMarksPossible) * 100
        : 0;

    const accuracy =
      total.totalQuestions > 0
        ? (total.correctAnswers / total.totalQuestions) * 100
        : 0;

    return {
      totalTests: testResults.length,
      ...total,
      averageScore,
      accuracy,
    };
  }, [testResults]);

  if (authLoading || profileLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600 text-lg">Loading report...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="bg-[#ff6b35] text-white px-4 md:px-8 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-white hover:text-yellow-200 transition-colors"
            >
              ← Back
            </button>
            <div className="text-2xl font-bold">AcadXL</div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Combined Report</h1>
        <p className="text-gray-600 mb-8">Overall performance analysis across all your test attempts</p>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Tests</p>
            <p className="text-2xl font-bold text-blue-700">{overallStats.totalTests}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Average Score</p>
            <p className="text-2xl font-bold text-green-700">
              {overallStats.averageScore.toFixed(1)}%
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Accuracy</p>
            <p className="text-2xl font-bold text-purple-700">
              {overallStats.accuracy.toFixed(1)}%
            </p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Questions</p>
            <p className="text-2xl font-bold text-orange-700">
              {overallStats.totalQuestions}
            </p>
          </div>
        </div>

        {/* Answer Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Answer Distribution</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {overallStats.correctAnswers}
              </div>
              <p className="text-sm text-gray-600">Correct Answers</p>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${
                      overallStats.totalQuestions > 0
                        ? (overallStats.correctAnswers / overallStats.totalQuestions) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 mb-2">
                {overallStats.incorrectAnswers}
              </div>
              <p className="text-sm text-gray-600">Incorrect Answers</p>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full"
                  style={{
                    width: `${
                      overallStats.totalQuestions > 0
                        ? (overallStats.incorrectAnswers / overallStats.totalQuestions) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600 mb-2">
                {overallStats.notAnswered}
              </div>
              <p className="text-sm text-gray-600">Not Answered</p>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gray-600 h-2 rounded-full"
                  style={{
                    width: `${
                      overallStats.totalQuestions > 0
                        ? (overallStats.notAnswered / overallStats.totalQuestions) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Subject-wise Performance */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Subject-wise Performance</h2>
          {subjectStats.length === 0 ? (
            <p className="text-gray-600">No subject data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Tests
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Questions
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Correct
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Incorrect
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Average Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subjectStats.map((stat) => (
                    <tr key={stat.subject} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{stat.subject}</td>
                      <td className="px-4 py-3 text-gray-600">{stat.totalTests}</td>
                      <td className="px-4 py-3 text-gray-600">{stat.totalQuestions}</td>
                      <td className="px-4 py-3 text-green-600 font-medium">
                        {stat.correctAnswers}
                      </td>
                      <td className="px-4 py-3 text-red-600 font-medium">
                        {stat.incorrectAnswers}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold ${
                            stat.averageScore >= 70
                              ? "text-green-600"
                              : stat.averageScore >= 50
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {stat.averageScore.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Performance Trends */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Trends</h2>
          {testResults.length === 0 ? (
            <p className="text-gray-600">No test attempts yet. Start taking tests to see your progress!</p>
          ) : (
            <div className="space-y-4">
              {testResults
                .sort((a, b) => {
                  const aTime = a.submittedAt?.toMillis() || 0;
                  const bTime = b.submittedAt?.toMillis() || 0;
                  return aTime - bTime; // Oldest first
                })
                .map((result, index) => {
                  const percentage =
                    result.totalMarksPossible > 0
                      ? (result.totalMarksObtained / result.totalMarksPossible) * 100
                      : 0;
                  const test = tests.get(result.testId);
                  const submittedDate = result.submittedAt?.toDate();

                  return (
                    <div
                      key={result.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {test?.title || result.testTitle || `Test ${index + 1}`}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {submittedDate
                              ? submittedDate.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "Unknown date"}
                          </p>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-2xl font-bold ${
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
                      <div className="mt-2 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            percentage >= 70
                              ? "bg-green-600"
                              : percentage >= 50
                              ? "bg-yellow-600"
                              : "bg-red-600"
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

