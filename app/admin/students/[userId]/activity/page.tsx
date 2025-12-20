// app/admin/students/[userId]/activity/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getUserDocument } from "@/lib/db/users";
import { getUserTestResults } from "@/lib/db/testResults";
import { getTestById } from "@/lib/db/tests";
import { getQuestionById } from "@/lib/db/questions";
import { analyzeTestResults } from "@/lib/utils/studentAnalysis";
import StudentAnalysisReport from "@/components/admin/StudentAnalysisReport";
import type { AppUser } from "@/lib/db/users";
import type { TestResult } from "@/lib/types/testResult";
import type { Test } from "@/lib/types/test";
import type { Question } from "@/lib/types/question";
import type { AnalysisData } from "@/lib/utils/studentAnalysis";

interface TestResultWithDetails extends TestResult {
  test?: Test | null;
  subjects?: string[];
}

export default function StudentActivityPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const userId = params?.userId as string;

  const [studentUser, setStudentUser] = useState<AppUser | null>(null);
  const [studentActivity, setStudentActivity] = useState<TestResultWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overallAnalysis, setOverallAnalysis] = useState<AnalysisData | null>(null);
  const [testAnalysisMap, setTestAnalysisMap] = useState<Map<string, AnalysisData>>(new Map());
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [showOverallAnalysis, setShowOverallAnalysis] = useState(false);

  const loadTestAnalysis = useCallback(async (testResult: TestResult) => {
    // Check if already loaded
    if (testAnalysisMap.has(testResult.testId)) {
      return;
    }

    setLoadingAnalysis(true);
    try {
      const testData = await analyzeTestResults(
        [testResult],
        getQuestionById,
        getTestById
      );
      setTestAnalysisMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(testResult.testId, testData);
        return newMap;
      });
    } catch (error) {
      console.error(`[StudentActivityPage] Error loading test analysis for ${testResult.testId}:`, error);
    } finally {
      setLoadingAnalysis(false);
    }
  }, []);

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

        // Load test details and extract subject information for each result
        const resultsWithDetails: TestResultWithDetails[] = await Promise.all(
          sortedResults.map(async (result) => {
            try {
              // Fetch test details
              const test = await getTestById(result.testId);
              
              // Extract unique subjects from questions
              let subjects: string[] = [];
              if (test && test.questions && test.questions.length > 0) {
                // Fetch questions to get subject information
                const questionPromises = test.questions.map((tq) =>
                  getQuestionById(tq.questionId)
                );
                const questions = await Promise.all(questionPromises);
                
                // Extract unique subjects
                const subjectSet = new Set<string>();
                questions.forEach((q) => {
                  if (q && q.subject) {
                    subjectSet.add(q.subject);
                  }
                });
                subjects = Array.from(subjectSet).sort();
              }
              
              return {
                ...result,
                test,
                subjects,
              };
            } catch (err) {
              console.error(`[StudentActivityPage] Error loading details for test ${result.testId}:`, err);
              return {
                ...result,
                test: null,
                subjects: [],
              };
            }
          })
        );
        
        setStudentActivity(resultsWithDetails);

        // Load overall analysis data (all tests combined)
        await loadOverallAnalysis(results);
      } catch (error) {
        console.error("[StudentActivityPage] Error loading data:", error);
        setError("Failed to load student activity. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const loadOverallAnalysis = async (testResults: TestResult[]) => {
      if (testResults.length === 0) return;

      setLoadingAnalysis(true);
      try {
        // Load overall analysis (all tests combined)
        const overallData = await analyzeTestResults(
          testResults,
          getQuestionById,
          getTestById
        );
        setOverallAnalysis(overallData);
      } catch (error) {
        console.error("[StudentActivityPage] Error loading overall analysis:", error);
      } finally {
        setLoadingAnalysis(false);
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
    <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all"
              aria-label="Go back"
            >
              <svg
                className="w-5 h-5"
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
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Student Activity Report</h1>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-sm">
                        {(studentUser.displayName || "U")[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {studentUser.displayName || "Unknown Student"}
                      </p>
                      {studentUser.email && (
                        <p className="text-sm text-gray-500">{studentUser.email}</p>
                      )}
                    </div>
                  </div>
                </div>
                {studentActivity.length > 0 && overallAnalysis && (
                  <button
                    onClick={() => setShowOverallAnalysis(!showOverallAnalysis)}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 border border-blue-200"
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
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {showOverallAnalysis ? "Hide" : "Combined Report"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Overall Analysis Section */}
        {studentActivity.length > 0 && overallAnalysis && showOverallAnalysis && (
          <div className="mb-8">
            {loadingAnalysis ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                <p className="text-sm text-gray-600">Loading analysis...</p>
              </div>
            ) : (
              <StudentAnalysisReport analysisData={overallAnalysis} />
            )}
          </div>
        )}

        {/* Summary Statistics */}
        {studentActivity.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Attempts</p>
                  <p className="text-3xl font-bold text-blue-600">{studentActivity.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLineJoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Average Score</p>
                  <p className="text-3xl font-bold text-green-600">
                    {studentActivity.length > 0
                      ? (
                          studentActivity.reduce((sum, result) => {
                            const percentage = (result.totalMarksObtained / result.totalMarksPossible) * 100;
                            return sum + percentage;
                          }, 0) / studentActivity.length
                        ).toFixed(1)
                      : "0.0"}
                    <span className="text-lg text-gray-500">%</span>
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLineJoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Test Attempts - Card Layout */}
        {studentActivity.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLineJoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900 mb-2">No test attempts found</p>
            <p className="text-sm text-gray-500">Test attempts will appear here once the student completes tests.</p>
          </div>
        ) : (
          <div className="space-y-4">
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
              const timeSpentHours = Math.floor(timeSpentMinutes / 60);
              const remainingMinutes = timeSpentMinutes % 60;

              const getScoreColor = () => {
                if (percentage >= 70) return "text-green-600 bg-green-50 border-green-200";
                if (percentage >= 50) return "text-yellow-600 bg-yellow-50 border-yellow-200";
                return "text-red-600 bg-red-50 border-red-200";
              };

              return (
                <div
                  key={result.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Left Section - Test Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {result.testTitle}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mb-3">
                            {/* Subjects */}
                            {result.subjects && result.subjects.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {result.subjects.map((subject, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"
                                  >
                                    {subject}
                                  </span>
                                ))}
                              </div>
                            )}
                            <span className="text-xs text-gray-500">
                              {result.totalQuestions} Questions
                            </span>
                          </div>
                        </div>
                        {/* Score Badge */}
                        <div className={`px-4 py-2 rounded-lg border ${getScoreColor()}`}>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{percentage.toFixed(1)}%</div>
                            <div className="text-xs font-medium mt-0.5">Score</div>
                          </div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs font-medium text-gray-600 mb-1">Marks</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {result.totalMarksObtained.toFixed(2)} / {result.totalMarksPossible.toFixed(2)}
                          </div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3">
                          <div className="text-xs font-medium text-green-700 mb-1">Correct</div>
                          <div className="text-sm font-semibold text-green-700">
                            {result.correctAnswers}
                          </div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-3">
                          <div className="text-xs font-medium text-red-700 mb-1">Incorrect</div>
                          <div className="text-sm font-semibold text-red-700">
                            {result.incorrectAnswers}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs font-medium text-gray-600 mb-1">Not Answered</div>
                          <div className="text-sm font-semibold text-gray-900">
                            {result.notAnswered}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Section - Meta Info & Actions */}
                    <div className="lg:w-48 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 pt-4 lg:pt-0 lg:pl-6">
                      <div className="space-y-3">
                        {/* Submission Date */}
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">Submitted</div>
                          <div className="text-sm text-gray-900">
                            {submittedDate
                              ? submittedDate.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </div>
                          {submittedDate && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {submittedDate.toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          )}
                        </div>

                        {/* Time Spent */}
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-1">Time Spent</div>
                          <div className="text-sm font-medium text-gray-900">
                            {timeSpentHours > 0
                              ? `${timeSpentHours}h ${remainingMinutes}m`
                              : `${remainingMinutes}m ${timeSpentSeconds}s`}
                          </div>
                        </div>

                        {/* Solutions Button */}
                        <button
                          onClick={() => {
                            router.push(`/dashboard/tests/${result.testId}/result/${result.id}`);
                          }}
                          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLineJoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLineJoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Solutions
                        </button>

                        {/* Test Report Button */}
                        <button
                          onClick={async () => {
                            if (expandedTestId === result.testId) {
                              setExpandedTestId(null);
                            } else {
                              // Load analysis if not already loaded
                              if (!testAnalysisMap.has(result.testId)) {
                                await loadTestAnalysis(result);
                              }
                              setExpandedTestId(result.testId);
                            }
                          }}
                          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLineJoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          {expandedTestId === result.testId ? "Hide" : "Test Report"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Test-wise Analysis */}
                  {expandedTestId === result.testId && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      {loadingAnalysis && !testAnalysisMap.has(result.testId) ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mb-2"></div>
                          <p className="text-sm text-gray-600">Loading analysis...</p>
                        </div>
                      ) : testAnalysisMap.has(result.testId) ? (
                        <StudentAnalysisReport
                          analysisData={testAnalysisMap.get(result.testId)!}
                          testTitle={result.testTitle}
                        />
                      ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                          <p className="text-sm text-gray-500">Failed to load analysis</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


