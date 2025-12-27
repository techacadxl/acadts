// app/admin/add-demo-questions/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { createQuestion } from "@/lib/db/questions";
import type { QuestionInput, QuestionType, DifficultyLevel } from "@/lib/types/question";
import subjectsData from "@/lib/data/subjects.json";

// Helper functions
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQuestion(
  index: number,
  subject: any,
  chapter: any,
  topic: any,
  subtopic: string
): QuestionInput {
  const questionTypes: QuestionType[] = ["mcq_single", "mcq_multiple", "numerical"];
  const difficulties: DifficultyLevel[] = ["easy", "medium", "hard"];
  const type = randomElement(questionTypes);
  const difficulty = randomElement(difficulties);

  // Generate question text based on topic
  const questionTexts: Record<string, string[]> = {
    "Kinematics": [
      "A particle moves along a straight line with velocity v = 3t² - 2t + 1 m/s. What is the acceleration at t = 2s?",
      "A car starts from rest and accelerates uniformly at 2 m/s². What distance does it cover in 5 seconds?",
      "A ball is thrown vertically upward with velocity 20 m/s. What is the maximum height reached?",
    ],
    "Dynamics": [
      "A block of mass 5 kg is pulled by a force of 20 N. If the coefficient of friction is 0.3, what is the acceleration?",
      "Two forces of 10 N and 15 N act at an angle of 60°. What is the magnitude of the resultant force?",
      "A body of mass 2 kg is moving with velocity 5 m/s. What is its kinetic energy?",
    ],
    "Electrostatics": [
      "Two point charges of +5 μC and -3 μC are placed 10 cm apart. What is the force between them?",
      "What is the electric field at a distance of 2 m from a point charge of 4 μC?",
      "A capacitor of 10 μF is charged to 100 V. What is the energy stored?",
    ],
    "Current Electricity": [
      "A resistor of 10 Ω is connected to a 20 V battery. What is the current flowing?",
      "Three resistors of 2 Ω, 3 Ω, and 6 Ω are connected in parallel. What is the equivalent resistance?",
      "A current of 2 A flows through a resistor of 5 Ω for 10 seconds. What is the heat produced?",
    ],
    "Thermodynamics": [
      "A gas expands isothermally from volume 2 L to 4 L at 300 K. What is the work done?",
      "What is the change in internal energy when 100 J of heat is added to a system and 50 J of work is done?",
      "A heat engine has efficiency 40%. If it absorbs 500 J of heat, what is the work done?",
    ],
    "Optics": [
      "An object is placed 20 cm from a convex lens of focal length 15 cm. What is the image distance?",
      "What is the angle of deviation for a ray passing through a prism of angle 60° and refractive index 1.5?",
      "In Young's double slit experiment, if the wavelength is 600 nm and slit separation is 0.5 mm, what is the fringe width?",
    ],
  };

  const defaultQuestions = [
    `Question ${index + 1}: A problem related to ${subtopic} in ${topic.name}. Solve the following:`,
    `Question ${index + 1}: Calculate the value based on ${subtopic} principles.`,
    `Question ${index + 1}: Analyze the following scenario in ${subtopic}.`,
  ];

  const topicKey = topic.name;
  const availableQuestions = questionTexts[topicKey] || defaultQuestions;
  const text = availableQuestions[index % availableQuestions.length] || defaultQuestions[0];

  let options: string[] | undefined;
  let correctOptions: number[] | undefined;
  let correctAnswer: string | null = null;

  if (type === "mcq_single" || type === "mcq_multiple") {
    const baseValue = randomInt(1, 50);
    options = [
      `${baseValue}`,
      `${baseValue + randomInt(1, 10)}`,
      `${baseValue + randomInt(11, 20)}`,
      `${baseValue - randomInt(1, 10)}`,
    ];
    
    if (type === "mcq_single") {
      correctOptions = [randomInt(0, 3)];
    } else {
      const indices = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2);
      correctOptions = indices.sort((a, b) => a - b);
    }
  } else {
    correctAnswer = `${randomInt(1, 1000)}`;
  }

  const explanation = `This question tests understanding of ${subtopic} in ${topic.name}. The correct approach involves applying the fundamental principles and formulas related to this topic. Review the concepts of ${subtopic} to understand the solution better.`;

  const tags = [
    subject.name.toLowerCase().replace(/\s+/g, "-"),
    chapter.name.toLowerCase().replace(/\s+/g, "-"),
    topic.name.toLowerCase().replace(/\s+/g, "-"),
    "jee-main",
    "demo",
  ];

  return {
    type,
    subject: subject.name,
    chapter: chapter.name,
    topic: topic.name,
    subtopic,
    customId: `DEMO-${String(index + 1).padStart(3, "0")}`,
    tags,
    text,
    imageUrl: null,
    options,
    correctOptions,
    correctAnswer,
    explanation,
    marks: difficulty === "easy" ? 1 : difficulty === "medium" ? 2 : 3,
    penalty: type === "mcq_single" ? 0.25 : type === "mcq_multiple" ? 0.5 : 0,
    difficulty,
  };
}

export default function AddDemoQuestionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 180, message: "" });
  const [completed, setCompleted] = useState(false);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user || role !== "admin") {
    router.replace("/admin");
    return null;
  }

  const handleAddQuestions = async () => {
    if (!user) return;

    setAdding(true);
    setProgress({ current: 0, total: 180, message: "Generating questions..." });
    setCompleted(false);

    const questions: QuestionInput[] = [];
    let questionIndex = 0;

    // Generate 180 questions
    for (const subject of subjectsData.subjects) {
      for (const chapter of subject.chapters) {
        for (const topic of chapter.topics) {
          for (const subtopic of topic.subtopics) {
            if (questionIndex >= 180) break;
            
            const question = generateQuestion(
              questionIndex,
              subject,
              chapter,
              topic,
              subtopic
            );
            questions.push(question);
            questionIndex++;
          }
          if (questionIndex >= 180) break;
        }
        if (questionIndex >= 180) break;
      }
      if (questionIndex >= 180) break;
    }

    // Fill remaining if needed
    while (questionIndex < 180) {
      const subject = randomElement(subjectsData.subjects);
      const chapter = randomElement(subject.chapters);
      const topic = randomElement(chapter.topics);
      const subtopic = randomElement(topic.subtopics);
      
      const question = generateQuestion(
        questionIndex,
        subject,
        chapter,
        topic,
        subtopic
      );
      questions.push(question);
      questionIndex++;
    }

    setProgress({ current: 0, total: 180, message: `Adding ${questions.length} questions to database...` });

    // Add questions in batches
    const batchSize = 10;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (question, idx) => {
          try {
            await createQuestion(question, user.uid);
            successCount++;
            setProgress({
              current: i + idx + 1,
              total: 180,
              message: `Added ${i + idx + 1}/180 questions...`,
            });
          } catch (error) {
            errorCount++;
            console.error(`Error adding question ${i + idx + 1}:`, error);
          }
        })
      );

      // Small delay between batches
      if (i + batchSize < questions.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    setProgress({
      current: 180,
      total: 180,
      message: `Completed! Successfully added ${successCount} questions. ${errorCount} errors.`,
    });
    setAdding(false);
    setCompleted(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Add Demo Questions</h1>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            This will add 180 demo questions to your database covering various subjects, 
            chapters, topics, and subtopics. The questions will be distributed across:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>Physics, Chemistry (Inorganic, Organic, Physical), and Mathematics</li>
            <li>Different question types: Single MCQ, Multiple MCQ, and Numerical</li>
            <li>Different difficulty levels: Easy, Medium, and Hard</li>
            <li>All questions will have explanations and proper tagging</li>
          </ul>
        </div>

        {!completed && (
          <button
            onClick={handleAddQuestions}
            disabled={adding}
            className="w-full bg-[#ff6b35] hover:bg-yellow-400 text-white py-3 rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
          >
            {adding ? "Adding Questions..." : "Add 180 Demo Questions"}
          </button>
        )}

        {adding && (
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm text-gray-600">
              <span>{progress.message}</span>
              <span>{progress.current}/{progress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-[#ff6b35] h-4 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {completed && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-semibold mb-2">✓ Questions Added Successfully!</p>
            <p className="text-green-700 text-sm mb-4">{progress.message}</p>
            <div className="flex gap-4">
              <button
                onClick={() => router.push("/admin/questions")}
                className="px-4 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-medium transition-all"
              >
                View All Questions
              </button>
              <button
                onClick={() => {
                  setCompleted(false);
                  setProgress({ current: 0, total: 180, message: "" });
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-all"
              >
                Add More
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

