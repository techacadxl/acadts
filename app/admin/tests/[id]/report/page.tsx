// app/admin/tests/[id]/report/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getTestById } from "@/lib/db/tests";
import { getTestResultsByTestId } from "@/lib/db/testResults";
import { getQuestionById } from "@/lib/db/questions";
import type { Test } from "@/lib/types/test";
import type { TestResult } from "@/lib/types/testResult";
import type { Question } from "@/lib/types/question";

interface ScoreDistribution {
  range: string;
  count: number;
  percentage: number;
}

interface TopicPerformance {
  topic: string;
  totalAttempts: number;
  averageScore: number;
  correctAnswers: number;
  totalQuestions: number;
}

export default function TestReportPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const testId = params?.id as string;

  const [test, setTest] = useState<Test | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [questions, setQuestions] = useState<Map<string, Question>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || profileLoading || !testId) return;

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
        const [testData, resultsData] = await Promise.all([
          getTestById(testId),
          getTestResultsByTestId(testId),
        ]);

        if (!testData) {
          setError("Test not found.");
          setLoading(false);
          return;
        }

        setTest(testData);
        setTestResults(resultsData);

        // Load all question details for topic information
        const questionIds = new Set<string>();
        testData.questions.forEach(tq => questionIds.add(tq.questionId));
        
        const questionPromises = Array.from(questionIds).map(qId => getQuestionById(qId));
        const questionResults = await Promise.all(questionPromises);
        
        const questionsMap = new Map<string, Question>();
        questionResults.forEach(q => {
          if (q) questionsMap.set(q.id, q);
        });
        setQuestions(questionsMap);
      } catch (err) {
        console.error("[TestReportPage] Error loading data:", err);
        setError("Failed to load test report. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, profileLoading, user, role, router, testId]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (testResults.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        averageTimeSpent: 0,
      };
    }

    const scores = testResults.map(
      (r) => r.totalMarksPossible > 0 ? (r.totalMarksObtained / r.totalMarksPossible) * 100 : 0
    );
    const times = testResults.map((r) => r.timeSpentSeconds || 0);

    return {
      totalAttempts: testResults.length,
      averageScore:
        scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      averageTimeSpent: times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0,
    };
  }, [testResults]);

  // Score distribution
  const scoreDistribution = useMemo(() => {
    const ranges: ScoreDistribution[] = [
      { range: "90-100%", count: 0, percentage: 0 },
      { range: "80-89%", count: 0, percentage: 0 },
      { range: "70-79%", count: 0, percentage: 0 },
      { range: "60-69%", count: 0, percentage: 0 },
      { range: "50-59%", count: 0, percentage: 0 },
      { range: "0-49%", count: 0, percentage: 0 },
    ];

    testResults.forEach((result) => {
      const percentage = (result.totalMarksObtained / result.totalMarksPossible) * 100;
      if (percentage >= 90) ranges[0].count++;
      else if (percentage >= 80) ranges[1].count++;
      else if (percentage >= 70) ranges[2].count++;
      else if (percentage >= 60) ranges[3].count++;
      else if (percentage >= 50) ranges[4].count++;
      else ranges[5].count++;
    });

    const total = testResults.length;
    ranges.forEach((range) => {
      range.percentage = total > 0 ? (range.count / total) * 100 : 0;
    });

    return ranges;
  }, [testResults]);

  // Topic-wise performance
  const topicPerformance = useMemo(() => {
    if (!test || testResults.length === 0 || questions.size === 0) return [];

    const topicMap = new Map<string, TopicPerformance>();

    // Initialize topics from test questions
    test.questions.forEach((testQuestion) => {
      const question = questions.get(testQuestion.questionId);
      if (!question) return;
      
      const topic = question.topic || "Other";
      if (!topicMap.has(topic)) {
        topicMap.set(topic, {
          topic,
          totalAttempts: 0,
          averageScore: 0,
          correctAnswers: 0,
          totalQuestions: 0,
        });
      }
      const perf = topicMap.get(topic)!;
      perf.totalQuestions += 1;
    });

    // Calculate performance from results using responses (which have isCorrect already calculated)
    testResults.forEach((result) => {
      if (!result.responses) return;

      // Create a map of questionId to response for quick lookup
      const responseMap = new Map(result.responses.map(r => [r.questionId, r]));

      test.questions.forEach((testQuestion) => {
        const question = questions.get(testQuestion.questionId);
        if (!question) return;
        
        const topic = question.topic || "Other";
        const perf = topicMap.get(topic);
        if (!perf) return;

        const response = responseMap.get(testQuestion.questionId);
        if (!response) return;

        perf.totalAttempts += 1;

        // Use the isCorrect field from response (already calculated correctly)
        if (response.isCorrect) {
          perf.correctAnswers += 1;
        }
      });
    });

    // Calculate average scores (accuracy = correct / total attempts)
    const performanceArray = Array.from(topicMap.values()).map((perf) => {
      perf.averageScore =
        perf.totalAttempts > 0
          ? (perf.correctAnswers / perf.totalAttempts) * 100
          : 0;
      return perf;
    });

    return performanceArray.sort((a, b) => b.averageScore - a.averageScore);
  }, [test, testResults, questions]);

  if (authLoading || profileLoading || loading) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading test report...</p>
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

  if (error || !test) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-red-600 mb-4">{error || "Test not found."}</p>
            <button
              onClick={() => router.push("/admin/tests")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Back to Tests
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
              onClick={() => router.push("/admin/tests")}
              className="text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Back to tests"
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
              <h1 className="text-2xl font-semibold text-gray-900">Test Report</h1>
              <p className="text-sm text-gray-600 mt-1">{test.title}</p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900">Total Attempts</p>
            <p className="text-2xl font-bold text-blue-700">{statistics.totalAttempts}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900">Average Score</p>
            <p className="text-2xl font-bold text-green-700">
              {statistics.averageScore.toFixed(1)}%
            </p>
            {testResults.length > 0 && (
              <p className="text-xs text-green-700 mt-1">
                {(statistics.averageScore * testResults[0].totalMarksPossible / 100).toFixed(0)} / {testResults[0].totalMarksPossible.toFixed(0)}
              </p>
            )}
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm font-medium text-purple-900">Highest Score</p>
            <p className="text-2xl font-bold text-purple-700">
              {statistics.highestScore.toFixed(1)}%
            </p>
            {testResults.length > 0 && (
              <p className="text-xs text-purple-700 mt-1">
                {(statistics.highestScore * testResults[0].totalMarksPossible / 100).toFixed(0)} / {testResults[0].totalMarksPossible.toFixed(0)}
              </p>
            )}
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm font-medium text-orange-900">Lowest Score</p>
            <p className="text-2xl font-bold text-orange-700">
              {statistics.lowestScore.toFixed(1)}%
            </p>
            {testResults.length > 0 && (
              <p className="text-xs text-orange-700 mt-1">
                {(statistics.lowestScore * testResults[0].totalMarksPossible / 100).toFixed(0)} / {testResults[0].totalMarksPossible.toFixed(0)}
              </p>
            )}
          </div>
        </div>

        {/* Score Distribution */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Score Distribution</h2>
          {testResults.length === 0 ? (
            <p className="text-gray-600">No attempts yet.</p>
          ) : (
            <div className="space-y-3">
              {scoreDistribution.map((range) => (
                <div key={range.range}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{range.range}</span>
                    <span className="text-sm text-gray-600">
                      {range.count} ({range.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all"
                      style={{ width: `${range.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Topic-wise Performance */}
        {topicPerformance.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Topic-wise Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Topic
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Questions
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Correct
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Average Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topicPerformance.map((perf) => (
                    <tr key={perf.topic} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{perf.topic}</td>
                      <td className="px-4 py-3 text-gray-600">{perf.totalQuestions}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {perf.correctAnswers} / {perf.totalAttempts * perf.totalQuestions || 1}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold ${
                            perf.averageScore >= 70
                              ? "text-green-600"
                              : perf.averageScore >= 50
                              ? "text-yellow-600"
                              : "text-red-600"
                          }`}
                        >
                          {perf.averageScore.toFixed(1)}%
                        </span>
                        {testResults.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {(perf.averageScore * testResults[0].totalMarksPossible / 100).toFixed(0)} / {testResults[0].totalMarksPossible.toFixed(0)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

