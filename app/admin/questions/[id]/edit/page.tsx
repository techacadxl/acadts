"use client";

import { FormEvent, useCallback, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getQuestionById, updateQuestion } from "@/lib/db/questions";
import type { QuestionType, DifficultyLevel, QuestionInput } from "@/lib/types/question";
import { sanitizeInput } from "@/lib/utils/validation";
import RichTextEditor from "@/components/RichTextEditor";
import { buildImageFolderPath } from "@/lib/utils/imageStorage";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq_single", label: "MCQ (Single Correct)" },
  { value: "mcq_multiple", label: "MCQ (Multiple Correct)" },
  { value: "numerical", label: "Numerical" },
];

const DIFFICULTIES: { value: DifficultyLevel; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export default function EditQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const questionId = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();

  const [type, setType] = useState<QuestionType>("mcq_single");
  const [subjectName, setSubjectName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [topicName, setTopicName] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [customId, setCustomId] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [text, setText] = useState(""); // TipTap HTML
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctOptions, setCorrectOptions] = useState<number[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState<string>("");
  const [explanation, setExplanation] = useState(""); // TipTap HTML
  const [marks, setMarks] = useState<string>("4");
  const [penalty, setPenalty] = useState<string>("0");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("easy");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load question data
  useEffect(() => {
    if (!questionId) return;

    const loadQuestion = async () => {
      console.log("[EditQuestionPage] Loading question:", questionId);
      setLoading(true);
      setError(null);

      try {
        const question = await getQuestionById(questionId);
        if (!question) {
          setError("Question not found.");
          setLoading(false);
          return;
        }

        // Populate form with existing data
        setType(question.type);
        setSubjectName(question.subject || "");
        setChapterName(question.chapter || "");
        setTopicName(question.topic || "");
        setSubtopic(question.subtopic || "");
        setCustomId(question.customId || "");
        setTagsInput(question.tags.join(", "));
        setText(question.text); // TipTap HTML
        setExplanation(question.explanation || "");
        setMarks(question.marks.toString());
        setPenalty(question.penalty.toString());
        setDifficulty(question.difficulty);

        if (question.options && question.options.length > 0) {
          const paddedOptions = [...question.options];
          while (paddedOptions.length < 4) {
            paddedOptions.push("");
          }
          setOptions(paddedOptions);
        }

        if (question.correctOptions) {
          setCorrectOptions(question.correctOptions);
        }

        if (question.correctAnswer) {
          setCorrectAnswer(question.correctAnswer);
        }

        console.log("[EditQuestionPage] Question loaded successfully");
        setLoading(false);
      } catch (err) {
        console.error("[EditQuestionPage] Error loading question:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load question.";
        setError(errorMessage);
        setLoading(false);
      }
    };

    if (authLoading || profileLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    loadQuestion();
  }, [questionId, authLoading, profileLoading, user, role, router]);

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const handleCorrectOptionToggle = useCallback(
    (index: number) => {
      if (type === "mcq_single") {
        setCorrectOptions([index]);
      } else if (type === "mcq_multiple") {
        setCorrectOptions((prev) =>
          prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
        );
      }
    },
    [type]
  );


  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      console.log("[EditQuestionPage] Form submitted, attempting to update question");

      if (!user) {
        setError("You must be logged in to edit questions.");
        return;
      }

      // Basic validation
      const sanitizedSubject = sanitizeInput(subjectName).trim();
      const sanitizedChapter = sanitizeInput(chapterName).trim();
      const sanitizedTopic = sanitizeInput(topicName).trim();
      const sanitizedSubtopic = sanitizeInput(subtopic).trim();
      const sanitizedText = text.trim(); // TipTap HTML
      const sanitizedExplanation = explanation.trim() || "";

      if (!sanitizedSubject) {
        setError("Subject is required.");
        return;
      }

      if (!sanitizedChapter) {
        setError("Chapter is required.");
        return;
      }

      if (!sanitizedTopic) {
        setError("Topic is required.");
        return;
      }

      if (!sanitizedSubtopic) {
        setError("Subtopic is required.");
        return;
      }

      if (!sanitizedText) {
        setError("Question text is required.");
        return;
      }

      const parsedMarks = Number(marks);
      const parsedPenalty = Number(penalty);

      if (Number.isNaN(parsedMarks) || parsedMarks <= 0) {
        setError("Marks must be a positive number.");
        return;
      }

      if (Number.isNaN(parsedPenalty)) {
        setError("Penalty must be a number (0 if none).");
        return;
      }

      // Type-specific validation
      let finalOptions: string[] | undefined = undefined;
      let finalCorrectOptions: number[] | undefined = undefined;
      let finalCorrectAnswer: string | null | undefined = null;

      if (type === "mcq_single" || type === "mcq_multiple") {
        const trimmedOptions = options.map((opt) => opt.trim());

        const originalToNewIndex: Map<number, number> = new Map();
        const nonEmptyOptions: string[] = [];
        let newIndex = 0;

        trimmedOptions.forEach((opt, originalIdx) => {
          if (opt.length > 0) {
            originalToNewIndex.set(originalIdx, newIndex);
            nonEmptyOptions.push(opt);
            newIndex++;
          }
        });

        finalOptions = nonEmptyOptions;

        if (finalOptions.length < 2) {
          setError("At least 2 options are required for MCQ questions.");
          return;
        }

        if (correctOptions.length === 0) {
          setError("Please select at least one correct option.");
          return;
        }

        const validIndices = correctOptions
          .filter((originalIdx) => originalToNewIndex.has(originalIdx))
          .map((originalIdx) => originalToNewIndex.get(originalIdx)!);

        if (validIndices.length === 0) {
          setError("Selected correct options must correspond to non-empty options.");
          return;
        }

        if (type === "mcq_single" && validIndices.length !== 1) {
          setError("Single correct MCQ must have exactly one correct option.");
          return;
        }

        finalCorrectOptions = validIndices;
        finalCorrectAnswer = null;
      } else if (type === "numerical") {
        const trimmedAnswer = correctAnswer.trim();
        if (!trimmedAnswer) {
          setError("Correct answer is required for numerical questions.");
          return;
        }
        finalCorrectAnswer = trimmedAnswer;
        finalOptions = undefined;
        finalCorrectOptions = undefined;
      }

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      setSubmitting(true);
      setError(null);

      try {
        const sanitizedCustomId = customId.trim() || undefined;
        
        const updates: Partial<QuestionInput> = {
          type,
          subject: sanitizedSubject,
          chapter: sanitizedChapter,
          topic: sanitizedTopic,
          subtopic: sanitizedSubtopic,
          customId: sanitizedCustomId,
          tags,
          text: sanitizedText, // TipTap HTML
          // imageUrl removed: all images should be inside text via TipTap
          ...(finalOptions !== undefined && { options: finalOptions }),
          ...(finalCorrectOptions !== undefined && { correctOptions: finalCorrectOptions }),
          correctAnswer: finalCorrectAnswer,
          explanation: sanitizedExplanation || null, // TipTap HTML
          marks: parsedMarks,
          penalty: parsedPenalty,
          difficulty,
        };

        console.log("[EditQuestionPage] Updating question with:", updates);

        await updateQuestion(questionId, updates);
        console.log("[EditQuestionPage] Question updated successfully");
        router.push(`/admin/questions/${questionId}`);
      } catch (err) {
        console.error("[EditQuestionPage] Error updating question:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to update question. Please try again.";
        setError(errorMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [
      user,
      questionId,
      subjectName,
      chapterName,
      topicName,
      subtopic,
      customId,
      text,
      explanation,
      tagsInput,
      options,
      correctOptions,
      correctAnswer,
      marks,
      penalty,
      difficulty,
      type,
      router,
    ]
  );

  const handleCancel = useCallback(() => {
    router.push(`/admin/questions/${questionId}`);
  }, [router, questionId]);

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="p-4 text-gray-600">Checking admin access...</p>
      </main>
    );
  }

  if (!user || role !== "admin") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="p-4 text-gray-600">Redirecting...</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="p-4 text-gray-600">Loading question...</p>
      </main>
    );
  }

  if (error && !questionId) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-white border border-red-200 rounded-lg p-6">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => router.push("/admin/questions")}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              ← Back to Questions
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Edit Question</h1>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-600 hover:text-gray-800 underline focus:outline-none"
            >
              Cancel
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Update the question details below.
          </p>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Subject + Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="e.g. Physics, Mathematics"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Question Type <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={type}
                  onChange={(e) => setType(e.target.value as QuestionType)}
                  required
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chapter + Topic */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Chapter <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={chapterName}
                  onChange={(e) => setChapterName(e.target.value)}
                  placeholder="e.g. Mechanics, Algebra"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Topic <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="e.g. Kinematics, Linear Equations"
                  required
                />
              </div>
            </div>

            {/* Subtopic */}
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Subtopic <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                value={subtopic}
                onChange={(e) => setSubtopic(e.target.value)}
                placeholder="e.g. 1D Motion, Quadratic Equations"
                required
              />
            </div>

            {/* Custom ID */}
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Custom ID
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="e.g. PHY-001, MATH-2024-01"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional. A custom identifier to easily identify this question (e.g., PHY-001, MATH-2024-01).
              </p>
            </div>

            {/* Tags */}
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Tags
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Comma separated, e.g. JEE Main, 1D motion"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional. Use comma-separated tags to help with filtering later.
              </p>
            </div>

            {/* Difficulty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Difficulty
                </label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Marks + Penalty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Marks
                </label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={marks}
                  onChange={(e) => setMarks(e.target.value)}
                  min={1}
                  step="1"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Penalty (negative marking)
                </label>
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={penalty}
                  onChange={(e) => setPenalty(e.target.value)}
                  step="1"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Use 0 if there is no negative marking.
                </p>
              </div>
            </div>

            {/* Question Text – Rich Editor */}
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Question Text
              </label>
              <RichTextEditor
                value={text}
                onChange={setText}
                placeholder="Write the question statement here... You can drag and drop images directly into the editor."
                minHeight="450px"
                imageFolder={
                  subjectName && chapterName && topicName && subtopic && type
                    ? buildImageFolderPath(subjectName, chapterName, topicName, subtopic, type)
                    : undefined
                }
              />
            </div>

            {/* Options / Correct answer based on type */}
            {(type === "mcq_single" || type === "mcq_multiple") && (
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  Options &amp; Correct Answer
                </p>
                <div className="space-y-4">
                  {options.map((opt, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="pt-2">
                        {type === "mcq_single" ? (
                          <input
                            type="radio"
                            name="correct-option"
                            className="h-4 w-4"
                            checked={correctOptions.includes(index)}
                            onChange={() => handleCorrectOptionToggle(index)}
                          />
                        ) : (
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={correctOptions.includes(index)}
                            onChange={() => handleCorrectOptionToggle(index)}
                          />
                        )}
                      </div>

                      <div className="flex-1">
                        <RichTextEditor
                          value={opt}
                          onChange={(value) => handleOptionChange(index, value)}
                          placeholder={`Option ${index + 1}... You can use special symbols, equations, and images here.`}
                          minHeight="200px"
                          imageFolder={
                            subjectName && chapterName && topicName && subtopic && type
                              ? buildImageFolderPath(subjectName, chapterName, topicName, subtopic, type)
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Mark the correct option{type === "mcq_multiple" ? "s" : ""} using{" "}
                  {type === "mcq_multiple" ? "checkboxes" : "the radio button"}.
                </p>
              </div>
            )}

            {type === "numerical" && (
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Correct Answer (Numerical)
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  placeholder="e.g. 9.8"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  You can decide later how strictly to compare (e.g. rounding / tolerance).
                </p>
              </div>
            )}

            {/* Explanation – Rich Editor */}
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Explanation (optional)
              </label>
              <RichTextEditor
                value={explanation}
                onChange={setExplanation}
                placeholder="Explanation, solution steps, or reasoning... You can drag and drop images directly into the editor."
                minHeight="350px"
                imageFolder={
                  subjectName && chapterName && topicName && subtopic && type
                    ? buildImageFolderPath(subjectName, chapterName, topicName, subtopic, type)
                    : undefined
                }
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="text-sm text-gray-600 hover:text-gray-800 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-black hover:bg-gray-900 text-white px-4 py-2 rounded text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
              >
                {submitting ? "Updating..." : "Update Question"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
