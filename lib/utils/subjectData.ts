// lib/utils/subjectData.ts
import subjectsData from '@/lib/data/subjects.json';

export interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  name: string;
  topics: Topic[];
}

export interface Topic {
  id: string;
  name: string;
  subtopics: string[];
}

export interface SubjectData {
  subjects: Subject[];
}

const data = subjectsData as SubjectData;

/**
 * Get all subjects
 */
export function getSubjects(): Subject[] {
  return data.subjects;
}

/**
 * Get a subject by ID
 */
export function getSubjectById(subjectId: string): Subject | undefined {
  return data.subjects.find(s => s.id === subjectId);
}

/**
 * Get chapters for a subject
 */
export function getChaptersBySubject(subjectId: string): Chapter[] {
  const subject = getSubjectById(subjectId);
  return subject?.chapters || [];
}

/**
 * Get a chapter by ID within a subject
 */
export function getChapterById(subjectId: string, chapterId: string): Chapter | undefined {
  const subject = getSubjectById(subjectId);
  return subject?.chapters.find(c => c.id === chapterId);
}

/**
 * Get topics for a chapter
 */
export function getTopicsByChapter(subjectId: string, chapterId: string): Topic[] {
  const chapter = getChapterById(subjectId, chapterId);
  return chapter?.topics || [];
}

/**
 * Get a topic by ID within a chapter
 */
export function getTopicById(subjectId: string, chapterId: string, topicId: string): Topic | undefined {
  const chapter = getChapterById(subjectId, chapterId);
  return chapter?.topics.find(t => t.id === topicId);
}

/**
 * Get subtopics for a topic
 */
export function getSubtopicsByTopic(subjectId: string, chapterId: string, topicId: string): string[] {
  const topic = getTopicById(subjectId, chapterId, topicId);
  return topic?.subtopics || [];
}

/**
 * Get subject name by ID
 */
export function getSubjectName(subjectId: string): string {
  const subject = getSubjectById(subjectId);
  return subject?.name || subjectId;
}

/**
 * Get chapter name by IDs
 */
export function getChapterName(subjectId: string, chapterId: string): string {
  const chapter = getChapterById(subjectId, chapterId);
  return chapter?.name || chapterId;
}

/**
 * Get topic name by IDs
 */
export function getTopicName(subjectId: string, chapterId: string, topicId: string): string {
  const topic = getTopicById(subjectId, chapterId, topicId);
  return topic?.name || topicId;
}


