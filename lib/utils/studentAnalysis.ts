// lib/utils/studentAnalysis.ts
import type { TestResult, QuestionResponse } from "@/lib/types/testResult";
import type { Question } from "@/lib/types/question";
import type { Test } from "@/lib/types/test";

export interface AnalysisStats {
  total: number;
  answered: number;
  unanswered: number;
  correct: number;
  incorrect: number;
  marksObtained: number;
  marksPossible: number;
  accuracy: number; // percentage
}

export interface SubjectAnalysis {
  subject: string;
  stats: AnalysisStats;
}

export interface TopicAnalysis {
  subject: string;
  topic: string;
  stats: AnalysisStats;
}

export interface SubtopicAnalysis {
  subject: string;
  topic: string;
  subtopic: string;
  stats: AnalysisStats;
}

export interface AnalysisData {
  subjectWise: SubjectAnalysis[];
  topicWise: TopicAnalysis[];
  subtopicWise: SubtopicAnalysis[];
}

/**
 * Analyze test results by subject, topic, and subtopic
 */
export async function analyzeTestResults(
  testResults: TestResult[],
  getQuestion: (questionId: string) => Promise<Question | null>,
  getTest: (testId: string) => Promise<Test | null>
): Promise<AnalysisData> {
  // Maps to store aggregated data
  const subjectMap = new Map<string, {
    answered: number;
    unanswered: number;
    correct: number;
    incorrect: number;
    marksObtained: number;
    marksPossible: number;
  }>();

  const topicMap = new Map<string, {
    subject: string;
    topic: string;
    answered: number;
    unanswered: number;
    correct: number;
    incorrect: number;
    marksObtained: number;
    marksPossible: number;
  }>();

  const subtopicMap = new Map<string, {
    subject: string;
    topic: string;
    subtopic: string;
    answered: number;
    unanswered: number;
    correct: number;
    incorrect: number;
    marksObtained: number;
    marksPossible: number;
  }>();

  // Process all test results
  for (const testResult of testResults) {
    // Get test structure to access question marks
    let test: Test | null = null;
    try {
      test = await getTest(testResult.testId);
    } catch (error) {
      console.error(`[StudentAnalysis] Error fetching test ${testResult.testId}:`, error);
    }

    // Create a map of questionId -> marks from test structure
    const questionMarksMap = new Map<string, number>();
    if (test) {
      for (const testQuestion of test.questions) {
        questionMarksMap.set(testQuestion.questionId, testQuestion.marks);
      }
    }

    // Process each response
    for (const response of testResult.responses) {
      try {
        const question = await getQuestion(response.questionId);
        if (!question) continue;

        const subject = question.subject || "Unknown";
        const topic = question.topic || "Unknown";
        const subtopic = question.subtopic || "Unknown";

        // Determine if answered
        const isAnswered = response.studentAnswer !== null && response.studentAnswer !== undefined;
        const isCorrect = response.isCorrect;
        const marksObtained = response.marksObtained;
        
        // Get question marks from test structure, fallback to question marks, then estimate
        const questionMarks = questionMarksMap.get(response.questionId) 
          || question.marks 
          || Math.abs(marksObtained) 
          || 1;

        // Update subject stats
        const subjectKey = subject;
        if (!subjectMap.has(subjectKey)) {
          subjectMap.set(subjectKey, {
            answered: 0,
            unanswered: 0,
            correct: 0,
            incorrect: 0,
            marksObtained: 0,
            marksPossible: 0,
          });
        }
        const subjectStats = subjectMap.get(subjectKey)!;
        subjectStats.marksPossible += questionMarks;
        if (isAnswered) {
          subjectStats.answered++;
          subjectStats.marksObtained += marksObtained;
          if (isCorrect) {
            subjectStats.correct++;
          } else {
            subjectStats.incorrect++;
          }
        } else {
          subjectStats.unanswered++;
        }

        // Update topic stats
        const topicKey = `${subject}::${topic}`;
        if (!topicMap.has(topicKey)) {
          topicMap.set(topicKey, {
            subject,
            topic,
            answered: 0,
            unanswered: 0,
            correct: 0,
            incorrect: 0,
            marksObtained: 0,
            marksPossible: 0,
          });
        }
        const topicStats = topicMap.get(topicKey)!;
        topicStats.marksPossible += questionMarks;
        if (isAnswered) {
          topicStats.answered++;
          topicStats.marksObtained += marksObtained;
          if (isCorrect) {
            topicStats.correct++;
          } else {
            topicStats.incorrect++;
          }
        } else {
          topicStats.unanswered++;
        }

        // Update subtopic stats
        const subtopicKey = `${subject}::${topic}::${subtopic}`;
        if (!subtopicMap.has(subtopicKey)) {
          subtopicMap.set(subtopicKey, {
            subject,
            topic,
            subtopic,
            answered: 0,
            unanswered: 0,
            correct: 0,
            incorrect: 0,
            marksObtained: 0,
            marksPossible: 0,
          });
        }
        const subtopicStats = subtopicMap.get(subtopicKey)!;
        subtopicStats.marksPossible += questionMarks;
        if (isAnswered) {
          subtopicStats.answered++;
          subtopicStats.marksObtained += marksObtained;
          if (isCorrect) {
            subtopicStats.correct++;
          } else {
            subtopicStats.incorrect++;
          }
        } else {
          subtopicStats.unanswered++;
        }
      } catch (error) {
        console.error(`[StudentAnalysis] Error processing question ${response.questionId}:`, error);
        // Continue with next question
      }
    }
  }

  // Convert maps to arrays and calculate accuracy
  const subjectWise: SubjectAnalysis[] = Array.from(subjectMap.entries())
    .map(([subject, stats]) => ({
      subject,
      stats: {
        total: stats.answered + stats.unanswered,
        answered: stats.answered,
        unanswered: stats.unanswered,
        correct: stats.correct,
        incorrect: stats.incorrect,
        marksObtained: stats.marksObtained,
        marksPossible: stats.marksPossible,
        accuracy: stats.answered > 0
          ? (stats.correct / stats.answered) * 100
          : 0,
      },
    }))
    .sort((a, b) => b.stats.total - a.stats.total);

  const topicWise: TopicAnalysis[] = Array.from(topicMap.values())
    .map((data) => ({
      subject: data.subject,
      topic: data.topic,
      stats: {
        total: data.answered + data.unanswered,
        answered: data.answered,
        unanswered: data.unanswered,
        correct: data.correct,
        incorrect: data.incorrect,
        marksObtained: data.marksObtained,
        marksPossible: data.marksPossible,
        accuracy: data.answered > 0
          ? (data.correct / data.answered) * 100
          : 0,
      },
    }))
    .sort((a, b) => {
      // Sort by subject first, then by total questions
      if (a.subject !== b.subject) {
        return a.subject.localeCompare(b.subject);
      }
      return b.stats.total - a.stats.total;
    });

  const subtopicWise: SubtopicAnalysis[] = Array.from(subtopicMap.values())
    .map((data) => ({
      subject: data.subject,
      topic: data.topic,
      subtopic: data.subtopic,
      stats: {
        total: data.answered + data.unanswered,
        answered: data.answered,
        unanswered: data.unanswered,
        correct: data.correct,
        incorrect: data.incorrect,
        marksObtained: data.marksObtained,
        marksPossible: data.marksPossible,
        accuracy: data.answered > 0
          ? (data.correct / data.answered) * 100
          : 0,
      },
    }))
    .sort((a, b) => {
      // Sort by subject, topic, then by total questions
      if (a.subject !== b.subject) {
        return a.subject.localeCompare(b.subject);
      }
      if (a.topic !== b.topic) {
        return a.topic.localeCompare(b.topic);
      }
      return b.stats.total - a.stats.total;
    });

  return {
    subjectWise,
    topicWise,
    subtopicWise,
  };
}


