// components/admin/StudentAnalysisReport.tsx
"use client";

import { useState, useMemo } from "react";
import type {
  AnalysisData,
  SubjectAnalysis,
  TopicAnalysis,
  SubtopicAnalysis,
  AnalysisStats,
} from "@/lib/utils/studentAnalysis";

interface StudentAnalysisReportProps {
  analysisData: AnalysisData;
  testTitle?: string; // If provided, shows test-wise analysis, otherwise overall
}

type AnalysisView = "subject" | "topic" | "subtopic";

export default function StudentAnalysisReport({
  analysisData,
  testTitle,
}: StudentAnalysisReportProps) {
  const [activeView, setActiveView] = useState<AnalysisView>("subject");
  const [searchQuery, setSearchQuery] = useState("");

  // Group topics by subject - must be at top level (Rules of Hooks)
  const topicsBySubject = useMemo(() => {
    const grouped = new Map<string, TopicAnalysis[]>();
    for (const topic of analysisData.topicWise) {
      if (!grouped.has(topic.subject)) {
        grouped.set(topic.subject, []);
      }
      grouped.get(topic.subject)!.push(topic);
    }
    return grouped;
  }, [analysisData.topicWise]);

  // Group subtopics by subject and topic - must be at top level (Rules of Hooks)
  const subtopicsBySubjectTopic = useMemo(() => {
    const grouped = new Map<string, SubtopicAnalysis[]>();
    for (const subtopic of analysisData.subtopicWise) {
      const key = `${subtopic.subject}::${subtopic.topic}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(subtopic);
    }
    return grouped;
  }, [analysisData.subtopicWise]);

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 70) return "text-green-700 bg-green-100";
    if (accuracy >= 50) return "text-yellow-700 bg-yellow-100";
    return "text-red-700 bg-red-100";
  };

  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy >= 70) return "✓ Strong";
    if (accuracy >= 50) return "~ Moderate";
    return "✗ Weak";
  };

  // Filtered and sorted data - by total questions descending
  const filteredAndSortedSubjects = useMemo(() => {
    let filtered = analysisData.subjectWise;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.subject.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => b.stats.total - a.stats.total);
  }, [analysisData.subjectWise, searchQuery]);

  const filteredAndSortedTopics = useMemo(() => {
    let filtered = analysisData.topicWise;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.subject.toLowerCase().includes(query) ||
        item.topic.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      if (a.subject !== b.subject) {
        return a.subject.localeCompare(b.subject);
      }
      return b.stats.total - a.stats.total;
    });
  }, [analysisData.topicWise, searchQuery]);

  const filteredAndSortedSubtopics = useMemo(() => {
    let filtered = analysisData.subtopicWise;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.subject.toLowerCase().includes(query) ||
        item.topic.toLowerCase().includes(query) ||
        item.subtopic.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      if (a.subject !== b.subject) {
        return a.subject.localeCompare(b.subject);
      }
      if (a.topic !== b.topic) {
        return a.topic.localeCompare(b.topic);
      }
      return b.stats.total - a.stats.total;
    });
  }, [analysisData.subtopicWise, searchQuery]);

  const renderSubjectTable = () => {
    if (filteredAndSortedSubjects.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? "No subjects found matching your search." : "No subject-wise data available"}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-300">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Subject
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Total
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Correct
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Incorrect
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Unanswered
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Accuracy
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Marks
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedSubjects.map((item, index) => (
              <tr 
                key={index} 
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {item.subject}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {item.stats.total}
                </td>
                <td className="px-4 py-3 text-center text-green-700 font-medium">
                  {item.stats.correct}
                </td>
                <td className="px-4 py-3 text-center text-red-700 font-medium">
                  {item.stats.incorrect}
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {item.stats.unanswered}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.stats.answered > 0 ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getAccuracyColor(item.stats.accuracy)}`}>
                        {item.stats.accuracy.toFixed(1)}%
                      </span>
                      <span className="text-xs text-gray-500">
                        {getAccuracyBadge(item.stats.accuracy)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  <div className="text-xs">
                    <div className="font-medium">{item.stats.marksObtained.toFixed(1)}</div>
                    <div className="text-gray-500">/ {item.stats.marksPossible.toFixed(1)}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTopicTable = () => {
    if (filteredAndSortedTopics.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? "No topics found matching your search." : "No topic-wise data available"}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-300">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Subject
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Topic
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Total
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Correct
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Incorrect
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Unanswered
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Accuracy
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Marks
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedTopics.map((item, index) => (
              <tr 
                key={index} 
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {item.subject}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                  {item.topic}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {item.stats.total}
                </td>
                <td className="px-4 py-3 text-center text-green-700 font-medium">
                  {item.stats.correct}
                </td>
                <td className="px-4 py-3 text-center text-red-700 font-medium">
                  {item.stats.incorrect}
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {item.stats.unanswered}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.stats.answered > 0 ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getAccuracyColor(item.stats.accuracy)}`}>
                        {item.stats.accuracy.toFixed(1)}%
                      </span>
                      <span className="text-xs text-gray-500">
                        {getAccuracyBadge(item.stats.accuracy)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  <div className="text-xs">
                    <div className="font-medium">{item.stats.marksObtained.toFixed(1)}</div>
                    <div className="text-gray-500">/ {item.stats.marksPossible.toFixed(1)}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSubtopicTable = () => {
    if (filteredAndSortedSubtopics.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? "No subtopics found matching your search." : "No subtopic-wise data available"}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-300">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Subject
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Topic
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">
                Subtopic
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Total
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Correct
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Incorrect
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Unanswered
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Accuracy
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">
                Marks
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedSubtopics.map((item, index) => (
              <tr 
                key={index} 
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {item.subject}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                  {item.topic}
                </td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {item.subtopic}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {item.stats.total}
                </td>
                <td className="px-4 py-3 text-center text-green-700 font-medium">
                  {item.stats.correct}
                </td>
                <td className="px-4 py-3 text-center text-red-700 font-medium">
                  {item.stats.incorrect}
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {item.stats.unanswered}
                </td>
                <td className="px-4 py-3 text-center">
                  {item.stats.answered > 0 ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getAccuracyColor(item.stats.accuracy)}`}>
                        {item.stats.accuracy.toFixed(1)}%
                      </span>
                      <span className="text-xs text-gray-500">
                        {getAccuracyBadge(item.stats.accuracy)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  <div className="text-xs">
                    <div className="font-medium">{item.stats.marksObtained.toFixed(1)}</div>
                    <div className="text-gray-500">/ {item.stats.marksPossible.toFixed(1)}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-300 shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-gray-300 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Performance Analysis Report</h2>
            {testTitle && (
              <p className="text-sm text-gray-600 mt-1">Test: {testTitle}</p>
            )}
            {!testTitle && (
              <p className="text-sm text-gray-600 mt-1">Overall Analysis (All Tests Combined)</p>
            )}
          </div>
        </div>

        {/* Search and Tabs */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLineJoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search by subject, topic, or subtopic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-white border border-gray-300 rounded-md p-1">
            <button
              onClick={() => setActiveView("subject")}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                activeView === "subject"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Subject
            </button>
            <button
              onClick={() => setActiveView("topic")}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                activeView === "topic"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Topic
            </button>
            <button
              onClick={() => setActiveView("subtopic")}
              className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                activeView === "subtopic"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              Subtopic
            </button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-auto max-h-[600px]">
        {activeView === "subject" && renderSubjectTable()}
        {activeView === "topic" && renderTopicTable()}
        {activeView === "subtopic" && renderSubtopicTable()}
      </div>

      {/* Summary Footer */}
      <div className="p-4 border-t border-gray-300 bg-gray-50 text-xs text-gray-600">
        <span>
          Showing {activeView === "subject" ? filteredAndSortedSubjects.length : activeView === "topic" ? filteredAndSortedTopics.length : filteredAndSortedSubtopics.length} {activeView === "subject" ? "subjects" : activeView === "topic" ? "topics" : "subtopics"}
          {searchQuery && ` matching "${searchQuery}"`}
        </span>
      </div>
    </div>
  );
}
