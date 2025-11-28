// app/admin/questions/new/page.tsx
"use client";

import { FormEvent, useCallback, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { createQuestion } from "@/lib/db/questions";
import type { QuestionType, DifficultyLevel, QuestionInput } from "@/lib/types/question";
import { sanitizeInput } from "@/lib/utils/validation";
import { uploadImage, validateImageFile, getImageStorageConfig } from "@/lib/utils/imageStorage";

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

export default function NewQuestionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();

  const [type, setType] = useState<QuestionType>("mcq_single");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [text, setText] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [correctOptions, setCorrectOptions] = useState<number[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState<string>("");
  const [explanation, setExplanation] = useState("");
  const [marks, setMarks] = useState<string>("4");
  const [penalty, setPenalty] = useState<string>("0");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("easy");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptionChange = (index: number, value: string) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const handleCorrectOptionToggle = useCallback((index: number) => {
    if (type === "mcq_single") {
      setCorrectOptions([index]);
    } else if (type === "mcq_multiple") {
      setCorrectOptions((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
      );
    }
  }, [type]);

  // Reset correct options and answer when question type changes
  useEffect(() => {
    setCorrectOptions([]);
    setCorrectAnswer("");
    if (type === "numerical") {
      setOptions(["", "", "", ""]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      console.log("[NewQuestionPage] Form submitted, attempting to create question");

      if (!user) {
        setError("You must be logged in to create questions.");
        return;
      }

      // Basic validation
      const sanitizedSubject = sanitizeInput(subject).trim();
      const sanitizedTopic = sanitizeInput(topic).trim();
      const sanitizedText = text.trim();
      const sanitizedExplanation = explanation.trim() || "";

      if (!sanitizedSubject) {
        setError("Subject is required.");
        return;
      }

      if (!sanitizedTopic) {
        setError("Topic is required.");
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
        
        // Build a map: original index -> new index after filtering
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

        // Map original indices to new indices after filtering
        const validIndices = correctOptions
          .filter((originalIdx) => {
            // Check if this original index corresponds to a non-empty option
            return originalToNewIndex.has(originalIdx);
          })
          .map((originalIdx) => {
            // Get the new index from the map
            return originalToNewIndex.get(originalIdx)!;
          });

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
        // Upload image if provided
        let finalImageUrl: string | null = null;
        if (imageFile) {
          console.log("[NewQuestionPage] Uploading image...");
          const config = getImageStorageConfig();
          const uploadResult = await uploadImage(imageFile, config);
          finalImageUrl = uploadResult.url;
          console.log("[NewQuestionPage] Image uploaded:", {
            url: finalImageUrl,
            provider: uploadResult.provider,
          });
        } else if (imageUrl) {
          // If image URL already exists (from previous upload), use it
          finalImageUrl = imageUrl;
        }

      const input: QuestionInput = {
        type,
        subject: sanitizedSubject,
        topic: sanitizedTopic,
        tags,
        text: sanitizedText,
        imageUrl: finalImageUrl,
        options: finalOptions,
        correctOptions: finalCorrectOptions,
        correctAnswer: finalCorrectAnswer,
        explanation: sanitizedExplanation || null,
        marks: parsedMarks,
        penalty: parsedPenalty,
        difficulty,
      };

      console.log("[NewQuestionPage] Final QuestionInput:", input);

        const id = await createQuestion(input, user.uid);
        console.log("[NewQuestionPage] Question created with id:", id);
        router.push("/admin/questions");
      } catch (err) {
        console.error("[NewQuestionPage] Error creating question:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create question. Please try again.";
        setError(errorMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [
      user,
      subject,
      topic,
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
      imageFile,
      imageUrl,
    ]
  );

  const handleCancel = useCallback(() => {
    router.push("/admin/questions");
  }, [router]);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      setError(validation.error || "Invalid image file");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Check admin access
  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      console.log("[NewQuestionPage] No user, redirecting to login");
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      console.log("[NewQuestionPage] Non-admin user, redirecting to dashboard");
      router.replace("/dashboard");
    }
  }, [authLoading, profileLoading, user, role, router]);

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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              New Question
            </h1>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-600 hover:text-gray-800 underline focus:outline-none"
            >
              Back to list
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Create a new question for the question bank.
          </p>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Subject + Topic */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Subject
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Physics"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Topic
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Kinematics"
                  required
                />
              </div>
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

            {/* Type + Difficulty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Question Type
                </label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as QuestionType)
                  }
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">
                  Difficulty
                </label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as DifficultyLevel)
                  }
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

            {/* Question Text */}
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Question Text
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent min-h-[120px]"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write the question statement here..."
                required
              />
            </div>

            {/* Question Image */}
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Question Image (Optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                aria-label="Upload question image"
              />
              <p className="mt-1 text-xs text-gray-500">
                Supported formats: JPEG, PNG, GIF, WebP. Max size: 500KB (completely free, no upgrade needed).
                <br />
                <span className="text-blue-600">
                  💡 Tip: Use <a href="https://tinypng.com" target="_blank" rel="noopener noreferrer" className="underline">TinyPNG</a> or <a href="https://squoosh.app" target="_blank" rel="noopener noreferrer" className="underline">Squoosh</a> to compress images before uploading.
                </span>
              </p>
              {imagePreview && (
                <div className="mt-3 relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-w-full max-h-64 rounded border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>

            {/* Options / Correct answer based on type */}
            {(type === "mcq_single" || type === "mcq_multiple") && (
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-800 mb-2">
                  Options &amp; Correct Answer
                </p>
                <div className="space-y-2">
                  {options.map((opt, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2"
                    >
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

                      <input
                        type="text"
                        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                        value={opt}
                        onChange={(e) =>
                          handleOptionChange(index, e.target.value)
                        }
                        placeholder={`Option ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">
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

            {/* Explanation */}
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Explanation (optional)
              </label>
              <textarea
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent min-h-[80px]"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Explanation, solution steps, or reasoning..."
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
                {submitting ? "Creating..." : "Create Question"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
