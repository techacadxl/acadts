// app/dashboard/reports/testwise/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getUserTestResults } from "@/lib/db/testResults";
import { getTestById } from "@/lib/db/tests";
import { getQuestionById } from "@/lib/db/questions";
import type { TestResult } from "@/lib/types/testResult";
import type { Test } from "@/lib/types/test";
import type { Question } from "@/lib/types/question";

interface TestAnalysis {
  test: Test;
  result: TestResult;
  percentage: number;
  topicBreakdown: Map<string, { correct: number; total: number }>;
}

export default function TestwiseReportPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [testAnalyses, setTestAnalyses] = useState<TestAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

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
        
        // Sort by submission date (newest first)
        const sortedResults = results.sort((a, b) => {
          const aTime = a.submittedAt?.toMillis() || 0;
          const bTime = b.submittedAt?.toMillis() || 0;
          return bTime - aTime;
        });

        // Load test details and create analyses
        const analyses: TestAnalysis[] = [];
        
        for (const result of sortedResults) {
          const test = await getTestById(result.testId);
          if (!test) continue;

          const percentage = result.totalMarksPossible > 0 
            ? (result.totalMarksObtained / result.totalMarksPossible) * 100 
            : 0;
          
          // Create topic breakdown using responses (which already have isCorrect calculated)
          const topicBreakdown = new Map<string, { correct: number; total: number }>();
          
          if (test.questions && result.responses) {
            // Load all question details to get topic information
            const questionIds = new Set<string>();
            test.questions.forEach(tq => questionIds.add(tq.questionId));
            
            const questionPromises = Array.from(questionIds).map(qId => getQuestionById(qId));
            const questionResults = await Promise.all(questionPromises);
            const questionsMap = new Map<string, Question>();
            questionResults.forEach(q => {
              if (q) questionsMap.set(q.id, q);
            });
            
            // Create a map of questionId to response for quick lookup
            const responseMap = new Map(result.responses.map(r => [r.questionId, r]));
            
            test.questions.forEach((testQuestion) => {
              const response = responseMap.get(testQuestion.questionId);
              if (!response) return; // Skip if response not found
              
              // Get topic from question details
              const question = questionsMap.get(testQuestion.questionId);
              const topic = question?.topic || "Other";
              const existing = topicBreakdown.get(topic) || { correct: 0, total: 0 };
              
              existing.total += 1;
              
              // Use the isCorrect field from response (already calculated correctly)
              if (response.isCorrect) {
                existing.correct += 1;
              }
              
              topicBreakdown.set(topic, existing);
            });
          }

          analyses.push({
            test,
            result,
            percentage,
            topicBreakdown,
          });
        }

        setTestAnalyses(analyses);
        if (analyses.length > 0) {
          setSelectedTestId(analyses[0].result.testId);
        }
      } catch (error) {
        console.error("[TestwiseReportPage] Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, authLoading, profileLoading, router]);

  const selectedAnalysis = testAnalyses.find(
    (a) => a.result.testId === selectedTestId
  );

  if (authLoading || profileLoading || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600 text-lg">Loading reports...</p>
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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Test-wise Report</h1>
        <p className="text-gray-600 mb-8">Detailed analysis for each test attempt</p>

        {testAnalyses.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 mb-2">No test attempts yet.</p>
            <p className="text-sm text-gray-500">
              Start taking tests to see detailed test-wise analysis!
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 px-6 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-semibold transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Test List Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Test</h2>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {testAnalyses.map((analysis) => {
                    const submittedDate = analysis.result.submittedAt?.toDate();
                    const isSelected = selectedTestId === analysis.result.testId;

                    return (
                      <button
                        key={analysis.result.id}
                        onClick={() => setSelectedTestId(analysis.result.testId)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? "border-[#ff6b35] bg-orange-50"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="font-medium text-gray-900 text-sm mb-1">
                          {analysis.test.title}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">
                            {submittedDate
                              ? submittedDate.toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "Unknown"}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              analysis.percentage >= 70
                                ? "text-green-600"
                                : analysis.percentage >= 50
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {analysis.percentage.toFixed(0)}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Test Analysis */}
            <div className="lg:col-span-2">
              {selectedAnalysis ? (
                <div className="space-y-6">
                  {/* Test Overview */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      {selectedAnalysis.test.title}
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Score</p>
                        <p className="text-lg font-bold text-gray-900">
                          {selectedAnalysis.result.totalMarksObtained.toFixed(2)} /{" "}
                          {selectedAnalysis.result.totalMarksPossible.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Percentage</p>
                        <p
                          className={`text-lg font-bold ${
                            selectedAnalysis.percentage >= 70
                              ? "text-green-600"
                              : selectedAnalysis.percentage >= 50
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {selectedAnalysis.percentage.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Correct</p>
                        <p className="text-lg font-bold text-green-600">
                          {selectedAnalysis.result.correctAnswers}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Incorrect</p>
                        <p className="text-lg font-bold text-red-600">
                          {selectedAnalysis.result.incorrectAnswers}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/tests/${selectedAnalysis.result.testId}/result/${selectedAnalysis.result.id}`
                          )
                        }
                        className="px-4 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all"
                      >
                        View Detailed Result
                      </button>
                    </div>
                  </div>

                  {/* Topic-wise Breakdown */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                      Topic-wise Performance
                    </h2>
                    {selectedAnalysis.topicBreakdown.size === 0 ? (
                      <p className="text-gray-600">No topic data available.</p>
                    ) : (
                      <div className="space-y-4">
                        {Array.from(selectedAnalysis.topicBreakdown.entries())
                          .sort((a, b) => {
                            const aScore = (a[1].correct / a[1].total) * 100;
                            const bScore = (b[1].correct / b[1].total) * 100;
                            return bScore - aScore;
                          })
                          .map(([topic, stats]) => {
                            const topicScore = (stats.correct / stats.total) * 100;
                            return (
                              <div key={topic} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="font-medium text-gray-900">{topic}</h3>
                                  <span
                                    className={`font-bold ${
                                      topicScore >= 70
                                        ? "text-green-600"
                                        : topicScore >= 50
                                        ? "text-yellow-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {topicScore.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  {stats.correct} / {stats.total} correct
                                </div>
                                <div className="bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      topicScore >= 70
                                        ? "bg-green-600"
                                        : topicScore >= 50
                                        ? "bg-yellow-600"
                                        : "bg-red-600"
                                    }`}
                                    style={{ width: `${topicScore}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Strengths & Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-green-900 mb-4">Strengths</h3>
                      {Array.from(selectedAnalysis.topicBreakdown.entries())
                        .filter(([_, stats]) => (stats.correct / stats.total) * 100 >= 70)
                        .length > 0 ? (
                        <ul className="space-y-2">
                          {Array.from(selectedAnalysis.topicBreakdown.entries())
                            .filter(([_, stats]) => (stats.correct / stats.total) * 100 >= 70)
                            .map(([topic, stats]) => (
                              <li key={topic} className="text-sm text-green-800">
                                ✓ {topic} ({(stats.correct / stats.total) * 100}%)
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-green-700">Keep practicing to identify strengths!</p>
                      )}
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-red-900 mb-4">Areas to Improve</h3>
                      {Array.from(selectedAnalysis.topicBreakdown.entries())
                        .filter(([_, stats]) => (stats.correct / stats.total) * 100 < 50)
                        .length > 0 ? (
                        <ul className="space-y-2">
                          {Array.from(selectedAnalysis.topicBreakdown.entries())
                            .filter(([_, stats]) => (stats.correct / stats.total) * 100 < 50)
                            .map(([topic, stats]) => (
                              <li key={topic} className="text-sm text-red-800">
                                ⚠ {topic} ({(stats.correct / stats.total) * 100}%)
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-red-700">Great job! Keep up the good work!</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
                  <p className="text-gray-600">Select a test to view detailed analysis</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

