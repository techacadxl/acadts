// app/admin/students/[userId]/activity/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getUserDocument } from "@/lib/db/users";
import { getUserEnrollments } from "@/lib/db/students";
import { getUserTestResults } from "@/lib/db/testResults";
import { getTestById } from "@/lib/db/tests";
import { getQuestionById } from "@/lib/db/questions";
import { exportToCSV, exportToHTML, printReport } from "@/lib/utils/export";
import { TableSkeleton, CardSkeleton } from "@/components/LoadingSkeleton";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { AppUser } from "@/lib/db/users";
import type { EnrollmentWithSeries } from "@/lib/db/students";
import type { TestResult } from "@/lib/types/testResult";
import type { Test } from "@/lib/types/test";
import type { Question } from "@/lib/types/question";

interface QuestionPerformance {
  question: Question;
  studentAnswer: number | number[] | string | null;
  isCorrect: boolean;
  marksObtained: number;
  marksPossible: number; // Test-specific marks for this question
  testTitle: string;
  testId: string;
}

interface TopicStats {
  subject: string;
  topic: string;
  subtopic?: string;
  total: number;
  correct: number;
  incorrect: number;
  notAnswered: number;
  marksObtained: number;
  marksPossible: number;
  accuracy: number;
}

interface CombinedReportData {
  overall: {
    total: number;
    correct: number;
    incorrect: number;
    notAnswered: number;
    marksObtained: number;
    marksPossible: number;
    accuracy: number;
  };
  bySubject: Map<string, TopicStats>;
  byTopic: Map<string, TopicStats>;
  bySubtopic: Map<string, TopicStats>;
}

interface TestReportData {
  test: Test;
  result: TestResult;
  questions: QuestionPerformance[];
  stats: CombinedReportData;
}

export default function StudentActivityPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const userId = params?.userId as string;

  const [student, setStudent] = useState<AppUser | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithSeries[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionPerformance[]>([]);
  const [testReports, setTestReports] = useState<TestReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [activeView, setActiveView] = useState<"combined" | "testwise">("combined");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [filterView, setFilterView] = useState<"subject" | "topic" | "subtopic">("topic");
  const [searchQuery, setSearchQuery] = useState("");

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
        const [studentData, enrollmentsData, resultsData] = await Promise.all([
          getUserDocument(userId),
          getUserEnrollments(userId),
          getUserTestResults(userId),
        ]);

        if (!studentData) {
          setError("Student not found.");
          setLoading(false);
          return;
        }

        setStudent(studentData);
        setEnrollments(enrollmentsData);
        
        // Sort test results by submission date (newest first)
        const sortedResults = resultsData.sort((a, b) => {
          const aTime = a.submittedAt?.toMillis() || 0;
          const bTime = b.submittedAt?.toMillis() || 0;
          return bTime - aTime;
        });
        setTestResults(sortedResults);

        // Load all question details and create performance data
        // OPTIMIZATION: Batch load all questions in parallel instead of sequentially
        const allQuestionData: QuestionPerformance[] = [];
        const testReportData: TestReportData[] = [];

        // First, load all tests in parallel
        const testPromises = sortedResults.map(result => getTestById(result.testId));
        const tests = await Promise.all(testPromises);
        
        // Collect all unique question IDs across all results
        const allQuestionIds = new Set<string>();
        sortedResults.forEach((result, idx) => {
          if (tests[idx]) {
            result.responses.forEach(response => {
              allQuestionIds.add(response.questionId);
            });
          }
        });

        // Batch load all questions in parallel
        const questionPromises = Array.from(allQuestionIds).map(qId => getQuestionById(qId));
        const questions = await Promise.all(questionPromises);
        const questionsMap = new Map<string, Question>();
        questions.forEach(q => {
          if (q) questionsMap.set(q.id, q);
        });

        // Now process results with pre-loaded data
        for (let i = 0; i < sortedResults.length; i++) {
          const result = sortedResults[i];
          const test = tests[i];
          if (!test) continue;

          const questionData: QuestionPerformance[] = [];
          
          // Process responses with pre-loaded questions
          for (const response of result.responses) {
            const question = questionsMap.get(response.questionId);
            if (!question) continue;

            // Get test-specific marks from the test configuration
            const testQuestion = test.questions.find(tq => tq.questionId === response.questionId);
            const marksPossible = testQuestion?.marks || question.marks || 0;

            const perf: QuestionPerformance = {
              question,
              studentAnswer: response.studentAnswer,
              isCorrect: response.isCorrect,
              marksObtained: response.marksObtained,
              marksPossible, // Use test-specific marks
              testTitle: result.testTitle,
              testId: result.testId,
            };
            
            questionData.push(perf);
            allQuestionData.push(perf);
          }

          // Calculate stats for this test
          const testStats = calculateStats(questionData);
          testReportData.push({
            test,
            result,
            questions: questionData,
            stats: testStats,
          });
        }

        setAllQuestions(allQuestionData);
        setTestReports(testReportData);
      } catch (err) {
        console.error("[StudentActivityPage] Error loading data:", err);
        setError("Failed to load student activity. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, profileLoading, user, role, router, userId]);

  // Calculate statistics from question performance data
  function calculateStats(questions: QuestionPerformance[]): CombinedReportData {
    const overall = {
      total: questions.length,
      correct: 0,
      incorrect: 0,
      notAnswered: 0,
      marksObtained: 0,
      marksPossible: 0,
      accuracy: 0,
    };

    const bySubject = new Map<string, TopicStats>();
    const byTopic = new Map<string, TopicStats>();
    const bySubtopic = new Map<string, TopicStats>();

    questions.forEach((perf) => {
      const q = perf.question;
      const subject = q.subject || "Other";
      const topic = q.topic || "Other";
      const subtopic = q.subtopic || "Other";
      
      // Use test-specific marks from performance data (not question default marks)
      const marksPossible = perf.marksPossible || 0;
      overall.marksPossible += marksPossible;
      overall.marksObtained += perf.marksObtained;

      // Overall stats
      if (perf.studentAnswer === null || perf.studentAnswer === undefined) {
        overall.notAnswered++;
      } else if (perf.isCorrect) {
        overall.correct++;
      } else {
        overall.incorrect++;
      }

      // Subject stats
      const subjectKey = subject;
      const subjectStat = bySubject.get(subjectKey) || {
        subject,
        topic: "",
        total: 0,
        correct: 0,
        incorrect: 0,
        notAnswered: 0,
        marksObtained: 0,
        marksPossible: 0,
        accuracy: 0,
      };
      subjectStat.total++;
      subjectStat.marksPossible += marksPossible;
      subjectStat.marksObtained += perf.marksObtained;
      if (perf.studentAnswer === null || perf.studentAnswer === undefined) {
        subjectStat.notAnswered++;
      } else if (perf.isCorrect) {
        subjectStat.correct++;
      } else {
        subjectStat.incorrect++;
      }
      bySubject.set(subjectKey, subjectStat);

      // Topic stats
      const topicKey = `${subject}::${topic}`;
      const topicStat = byTopic.get(topicKey) || {
        subject,
        topic,
        total: 0,
        correct: 0,
        incorrect: 0,
        notAnswered: 0,
        marksObtained: 0,
        marksPossible: 0,
        accuracy: 0,
      };
      topicStat.total++;
      topicStat.marksPossible += marksPossible;
      topicStat.marksObtained += perf.marksObtained;
      if (perf.studentAnswer === null || perf.studentAnswer === undefined) {
        topicStat.notAnswered++;
      } else if (perf.isCorrect) {
        topicStat.correct++;
      } else {
        topicStat.incorrect++;
      }
      byTopic.set(topicKey, topicStat);

      // Subtopic stats
      const subtopicKey = `${subject}::${topic}::${subtopic}`;
      const subtopicStat = bySubtopic.get(subtopicKey) || {
        subject,
        topic,
        subtopic,
        total: 0,
        correct: 0,
        incorrect: 0,
        notAnswered: 0,
        marksObtained: 0,
        marksPossible: 0,
        accuracy: 0,
      };
      subtopicStat.total++;
      subtopicStat.marksPossible += marksPossible;
      subtopicStat.marksObtained += perf.marksObtained;
      if (perf.studentAnswer === null || perf.studentAnswer === undefined) {
        subtopicStat.notAnswered++;
      } else if (perf.isCorrect) {
        subtopicStat.correct++;
      } else {
        subtopicStat.incorrect++;
      }
      bySubtopic.set(subtopicKey, subtopicStat);
    });

    // Calculate accuracies
    overall.accuracy = overall.total > 0 ? (overall.correct / overall.total) * 100 : 0;
    
    Array.from(bySubject.values()).forEach((stat) => {
      stat.accuracy = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
    });
    
    Array.from(byTopic.values()).forEach((stat) => {
      stat.accuracy = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
    });
    
    Array.from(bySubtopic.values()).forEach((stat) => {
      stat.accuracy = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0;
    });

    return { overall, bySubject, byTopic, bySubtopic };
  }

  const combinedStats = useMemo(() => calculateStats(allQuestions), [allQuestions]);

  // Filter stats based on search and view
  const filteredStats = useMemo(() => {
    let stats: TopicStats[] = [];
    
    if (filterView === "subject") {
      stats = Array.from(combinedStats.bySubject.values());
    } else if (filterView === "topic") {
      stats = Array.from(combinedStats.byTopic.values());
    } else {
      stats = Array.from(combinedStats.bySubtopic.values());
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      stats = stats.filter((stat) =>
        stat.subject.toLowerCase().includes(query) ||
        stat.topic.toLowerCase().includes(query) ||
        (stat.subtopic && stat.subtopic.toLowerCase().includes(query))
      );
    }

    return stats.sort((a, b) => {
      // Sort by subject, then topic, then subtopic
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      if (a.topic !== b.topic) return a.topic.localeCompare(b.topic);
      if (a.subtopic && b.subtopic) return a.subtopic.localeCompare(b.subtopic);
      return 0;
    });
  }, [combinedStats, filterView, searchQuery]);

  const selectedTestReport = useMemo(() => {
    if (!selectedTestId) return null;
    return testReports.find((tr) => tr.test.id === selectedTestId);
  }, [selectedTestId, testReports]);

  if (authLoading || profileLoading) {
    return <LoadingSpinner fullScreen text="Checking access..." />;
  }

  if (loading) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-6">
            <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-96 bg-gray-200 rounded animate-pulse"></div>
          </div>
          
          {/* Stats Cards Skeleton */}
          <CardSkeleton count={4} />
          
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

  if (error || !student) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-red-600 mb-4">{error || "Student not found."}</p>
            <button
              onClick={() => router.push("/admin/students")}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Back to All Students
            </button>
          </div>
        </div>
      </div>
    );
  }

  let createdAtDate: Date | null = null;
  if (student.createdAt) {
    if (typeof student.createdAt.toDate === "function") {
      createdAtDate = student.createdAt.toDate();
    } else if (student.createdAt.seconds) {
      createdAtDate = new Date(student.createdAt.seconds * 1000);
    }
  }

  return (
    <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/admin/students")}
                className="text-gray-600 hover:text-gray-900 transition-colors"
                aria-label="Back to all students"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLineCap="round" strokeLineJoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Student Activity Report</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {student.displayName || student.email || "Student"}
                </p>
              </div>
            </div>
            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const csvData = filteredStats.map((stat) => ({
                    Subject: stat.subject,
                    Topic: stat.topic,
                    Subtopic: stat.subtopic || "",
                    Total: stat.total,
                    Correct: stat.correct,
                    Incorrect: stat.incorrect,
                    "Not Answered": stat.notAnswered,
                    Accuracy: `${stat.accuracy.toFixed(1)}%`,
                    Marks: `${stat.marksObtained.toFixed(1)} / ${stat.marksPossible.toFixed(1)}`,
                  }));
                  exportToCSV(csvData, `student-activity-${student.uid}.csv`);
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Export CSV
              </button>
              <button
                onClick={() => {
                  if (activeView === "combined") {
                    // Print combined report
                    const printContent = `
                      <h1>Student Activity Report - Combined</h1>
                      <h2>Student: ${student.displayName || student.email}</h2>
                      <div style="margin: 20px 0;">
                        <div style="display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd;">
                          <strong>Total Attempts:</strong> ${testResults.length}
                        </div>
                        <div style="display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd;">
                          <strong>Average Score:</strong> ${combinedStats.overall.marksPossible > 0
                            ? ((combinedStats.overall.marksObtained / combinedStats.overall.marksPossible) * 100).toFixed(1)
                            : "0"}%<br/>
                          <span style="font-size: 0.9em; color: #666;">${combinedStats.overall.marksObtained.toFixed(0)} / ${combinedStats.overall.marksPossible.toFixed(0)}</span>
                        </div>
                        <div style="display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd;">
                          <strong>Accuracy:</strong> ${combinedStats.overall.accuracy.toFixed(1)}%
                        </div>
                        <div style="display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd;">
                          <strong>Issues:</strong> ${combinedStats.overall.incorrect + combinedStats.overall.notAnswered}<br/>
                          <span style="font-size: 0.9em; color: #666;">${combinedStats.overall.incorrect} incorrect + ${combinedStats.overall.notAnswered} unanswered</span>
                        </div>
                      </div>
                      <h3>Performance Breakdown by ${filterView.charAt(0).toUpperCase() + filterView.slice(1)}</h3>
                      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <thead>
                          <tr style="background-color: #f2f2f2; border-bottom: 2px solid #ddd;">
                            ${filterView === "subject" ? '<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Subject</th>' : ""}
                            ${filterView === "topic" ? '<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Subject</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Topic</th>' : ""}
                            ${filterView === "subtopic" ? '<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Subject</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Topic</th><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Subtopic</th>' : ""}
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Total</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Correct</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Incorrect</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Unanswered</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Accuracy</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Marks</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${filteredStats.map((stat) => `
                            <tr style="border-bottom: 1px solid #ddd;">
                              ${filterView === "subject" ? `<td style="padding: 8px; border: 1px solid #ddd;">${stat.subject}</td>` : ""}
                              ${filterView === "topic" ? `<td style="padding: 8px; border: 1px solid #ddd;">${stat.subject}</td><td style="padding: 8px; border: 1px solid #ddd;">${stat.topic}</td>` : ""}
                              ${filterView === "subtopic" ? `<td style="padding: 8px; border: 1px solid #ddd;">${stat.subject}</td><td style="padding: 8px; border: 1px solid #ddd;">${stat.topic}</td><td style="padding: 8px; border: 1px solid #ddd;">${stat.subtopic || "—"}</td>` : ""}
                              <td style="padding: 8px; border: 1px solid #ddd;">${stat.total}</td>
                              <td style="padding: 8px; border: 1px solid #ddd; color: green;">${stat.correct}</td>
                              <td style="padding: 8px; border: 1px solid #ddd; color: red;">${stat.incorrect}</td>
                              <td style="padding: 8px; border: 1px solid #ddd;">${stat.notAnswered}</td>
                              <td style="padding: 8px; border: 1px solid #ddd;">${stat.accuracy.toFixed(1)}% ${stat.accuracy >= 70 ? "✓ Strong" : "✗ Weak"}</td>
                              <td style="padding: 8px; border: 1px solid #ddd;">${stat.marksObtained.toFixed(1)} / ${stat.marksPossible.toFixed(1)}</td>
                            </tr>
                          `).join("")}
                        </tbody>
                      </table>
                      <p style="margin-top: 20px; color: #666;">Showing ${filteredStats.length} ${filterView}(s)</p>
                    `;
                    printReport(
                      `Student Activity Report - ${student.displayName || student.email}`,
                      printContent
                    );
                  } else if (selectedTestReport) {
                    // Print test-wise report
                    const testStats = selectedTestReport.stats;
                    const printContent = `
                      <h1>Test Report - ${selectedTestReport.result.testTitle}</h1>
                      <h2>Student: ${student.displayName || student.email}</h2>
                      <p>Date: ${selectedTestReport.result.submittedAt?.toDate?.()?.toLocaleDateString() || "Unknown"}</p>
                      <div style="margin: 20px 0;">
                        <div style="display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd;">
                          <strong>Total Questions:</strong> ${testStats.overall.total}
                        </div>
                        <div style="display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd;">
                          <strong>Score:</strong> ${testStats.overall.marksPossible > 0
                            ? ((testStats.overall.marksObtained / testStats.overall.marksPossible) * 100).toFixed(1)
                            : "0"}%<br/>
                          <span style="font-size: 0.9em; color: #666;">${testStats.overall.marksObtained.toFixed(0)} / ${testStats.overall.marksPossible.toFixed(0)}</span>
                        </div>
                        <div style="display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd;">
                          <strong>Accuracy:</strong> ${testStats.overall.accuracy.toFixed(1)}%
                        </div>
                        <div style="display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd;">
                          <strong>Issues:</strong> ${testStats.overall.incorrect + testStats.overall.notAnswered}<br/>
                          <span style="font-size: 0.9em; color: #666;">${testStats.overall.incorrect} incorrect + ${testStats.overall.notAnswered} unanswered</span>
                        </div>
                      </div>
                      <h3>Topic-wise Performance</h3>
                      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <thead>
                          <tr style="background-color: #f2f2f2; border-bottom: 2px solid #ddd;">
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Subject</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Topic</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Total</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Correct</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Incorrect</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Unanswered</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Accuracy</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Marks</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${Array.from(testStats.byTopic.values())
                            .sort((a, b) => {
                              if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
                              return a.topic.localeCompare(b.topic);
                            })
                            .map((stat) => `
                              <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; border: 1px solid #ddd;">${stat.subject}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${stat.topic}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${stat.total}</td>
                                <td style="padding: 8px; border: 1px solid #ddd; color: green;">${stat.correct}</td>
                                <td style="padding: 8px; border: 1px solid #ddd; color: red;">${stat.incorrect}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${stat.notAnswered}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${stat.accuracy.toFixed(1)}% ${stat.accuracy >= 70 ? "✓ Strong" : "✗ Weak"}</td>
                                <td style="padding: 8px; border: 1px solid #ddd;">${stat.marksObtained.toFixed(1)} / ${stat.marksPossible.toFixed(1)}</td>
                              </tr>
                            `).join("")}
                        </tbody>
                      </table>
                    `;
                    printReport(
                      `Test Report - ${selectedTestReport.result.testTitle} - ${student.displayName || student.email}`,
                      printContent
                    );
                  }
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Print
              </button>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex gap-4 border-b border-gray-200 mb-4">
            <button
              onClick={() => {
                setActiveView("combined");
                setSelectedTestId(null);
              }}
              className={`px-4 py-2 font-medium transition-colors ${
                activeView === "combined"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Combined Report
            </button>
            <button
              onClick={() => {
                setActiveView("testwise");
                if (testReports.length > 0 && !selectedTestId) {
                  setSelectedTestId(testReports[0].test.id);
                }
              }}
              className={`px-4 py-2 font-medium transition-colors ${
                activeView === "testwise"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Test-wise Report
            </button>
          </div>

          {/* Combined Report */}
          {activeView === "combined" && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Performance Analysis Report</h2>
              <p className="text-sm text-gray-600 mb-4">Overall Analysis (All Tests Combined)</p>

              {/* Search and Filter */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search by subject, topic, or subtopic..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilterView("subject")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterView === "subject"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Subject
                  </button>
                  <button
                    onClick={() => setFilterView("topic")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterView === "topic"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Topic
                  </button>
                  <button
                    onClick={() => setFilterView("subtopic")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filterView === "subtopic"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Subtopic
                  </button>
                </div>
              </div>

              {/* Overall Stats */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">Total Attempts</p>
                  <p className="text-2xl font-bold text-blue-700">{testResults.length}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-900">Average Score</p>
                  <p className="text-2xl font-bold text-green-700">
                    {combinedStats.overall.marksPossible > 0
                      ? ((combinedStats.overall.marksObtained / combinedStats.overall.marksPossible) * 100).toFixed(1)
                      : "0"}
                    %
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {combinedStats.overall.marksObtained.toFixed(0)} / {combinedStats.overall.marksPossible.toFixed(0)}
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-900">Issues</p>
                  <p className="text-2xl font-bold text-red-700">
                    {combinedStats.overall.incorrect + combinedStats.overall.notAnswered}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    {combinedStats.overall.incorrect} incorrect + {combinedStats.overall.notAnswered} unanswered
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-900">Accuracy</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {combinedStats.overall.accuracy.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Performance Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {filterView === "subject" && <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Subject</th>}
                      {filterView === "topic" && (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Subject</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Topic</th>
                        </>
                      )}
                      {filterView === "subtopic" && (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Subject</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Topic</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Subtopic</th>
                        </>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Correct</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Incorrect</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Unanswered</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Accuracy</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredStats.map((stat, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {filterView === "subject" && (
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.subject}</td>
                        )}
                        {filterView === "topic" && (
                          <>
                            <td className="px-4 py-3 text-sm text-gray-900">{stat.subject}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.topic}</td>
                          </>
                        )}
                        {filterView === "subtopic" && (
                          <>
                            <td className="px-4 py-3 text-sm text-gray-900">{stat.subject}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{stat.topic}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.subtopic || "—"}</td>
                          </>
                        )}
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.total}</td>
                        <td className="px-4 py-3 text-sm text-green-600 font-medium">{stat.correct}</td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">{stat.incorrect}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{stat.notAnswered}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`font-medium ${
                            stat.accuracy >= 70 ? "text-green-600" : stat.accuracy >= 50 ? "text-yellow-600" : "text-red-600"
                          }`}>
                            {stat.accuracy.toFixed(1)}%
                          </span>
                          <span className={`ml-2 ${stat.accuracy >= 70 ? "text-green-600" : "text-red-600"}`}>
                            {stat.accuracy >= 70 ? "✓ Strong" : "✗ Weak"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {stat.marksObtained.toFixed(1)} / {stat.marksPossible.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-600 mt-4">Showing {filteredStats.length} {filterView}(s)</p>
            </div>
          )}

          {/* Test-wise Report */}
          {activeView === "testwise" && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Test-wise Performance</h2>
              
              {/* Test Selector */}
              <div className="mb-4">
                <select
                  value={selectedTestId || ""}
                  onChange={(e) => setSelectedTestId(e.target.value)}
                  className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a test...</option>
                  {testReports.map((tr) => (
                    <option key={tr.test.id} value={tr.test.id}>
                      {tr.result.testTitle} - {tr.result.submittedAt?.toDate?.()?.toLocaleDateString() || "Unknown date"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTestReport && (
                <div>
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-900">Total Questions</p>
                      <p className="text-2xl font-bold text-blue-700">{selectedTestReport.stats.overall.total}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-900">Score</p>
                      <p className="text-2xl font-bold text-green-700">
                        {selectedTestReport.stats.overall.marksPossible > 0
                          ? ((selectedTestReport.stats.overall.marksObtained / selectedTestReport.stats.overall.marksPossible) * 100).toFixed(1)
                          : "0"}
                        %
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        {selectedTestReport.stats.overall.marksObtained.toFixed(0)} / {selectedTestReport.stats.overall.marksPossible.toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm text-purple-900">Accuracy</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {selectedTestReport.stats.overall.accuracy.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-900">Issues</p>
                      <p className="text-2xl font-bold text-red-700">
                        {selectedTestReport.stats.overall.incorrect + selectedTestReport.stats.overall.notAnswered}
                      </p>
                      <p className="text-xs text-red-700 mt-1">
                        {selectedTestReport.stats.overall.incorrect} incorrect + {selectedTestReport.stats.overall.notAnswered} unanswered
                      </p>
                    </div>
                  </div>

                  {/* Topic-wise breakdown for selected test */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Subject</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Topic</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Correct</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Incorrect</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Unanswered</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Accuracy</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Marks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Array.from(selectedTestReport.stats.byTopic.values())
                          .sort((a, b) => {
                            if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
                            return a.topic.localeCompare(b.topic);
                          })
                          .map((stat, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{stat.subject}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{stat.topic}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{stat.total}</td>
                              <td className="px-4 py-3 text-sm text-green-600 font-medium">{stat.correct}</td>
                              <td className="px-4 py-3 text-sm text-red-600 font-medium">{stat.incorrect}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{stat.notAnswered}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`font-medium ${
                                  stat.accuracy >= 70 ? "text-green-600" : stat.accuracy >= 50 ? "text-yellow-600" : "text-red-600"
                                }`}>
                                  {stat.accuracy.toFixed(1)}%
                                </span>
                                <span className={`ml-2 ${stat.accuracy >= 70 ? "text-green-600" : "text-red-600"}`}>
                                  {stat.accuracy >= 70 ? "✓ Strong" : "✗ Weak"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {stat.marksObtained.toFixed(1)} / {stat.marksPossible.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
