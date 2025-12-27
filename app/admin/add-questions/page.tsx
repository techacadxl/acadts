// app/admin/add-questions/page.tsx
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

// Generate question text based on subject, topic, and subtopic
function generateQuestionText(subject: string, topic: string, subtopic: string, index: number): string {
  // More comprehensive question templates
  const questionTemplates: Record<string, Record<string, string[]>> = {
    Physics: {
      "Kinematics": [
        "A particle moves along a straight line with velocity v = 3t² - 2t + 1 m/s. What is the acceleration at t = 2s?",
        "A car starts from rest and accelerates uniformly at 2 m/s². What distance does it cover in 5 seconds?",
        "A ball is thrown vertically upward with velocity 20 m/s. What is the maximum height reached?",
        "A particle moves in a circle of radius 2 m with constant speed 4 m/s. What is its centripetal acceleration?",
        "Two trains are moving towards each other with speeds 60 km/h and 40 km/h. If they are 200 km apart, when will they meet?",
      ],
      "Dynamics": [
        "A block of mass 5 kg is pulled by a force of 20 N. If the coefficient of friction is 0.3, what is the acceleration?",
        "Two forces of 10 N and 15 N act at an angle of 60°. What is the magnitude of the resultant force?",
        "A body of mass 2 kg is moving with velocity 5 m/s. What is its kinetic energy?",
        "A spring with spring constant 100 N/m is compressed by 0.1 m. What is the potential energy stored?",
        "A block slides down an inclined plane of angle 30°. If the coefficient of friction is 0.2, what is the acceleration?",
      ],
      "Electrostatics": [
        "Two point charges of +5 μC and -3 μC are placed 10 cm apart. What is the force between them?",
        "What is the electric field at a distance of 2 m from a point charge of 4 μC?",
        "A capacitor of 10 μF is charged to 100 V. What is the energy stored?",
        "Three charges of +2 μC, -3 μC, and +4 μC are placed at the vertices of an equilateral triangle of side 1 m. What is the net force on the +2 μC charge?",
        "What is the electric potential at the center of a ring of radius 0.5 m carrying a charge of 10 μC?",
      ],
      "Current Electricity": [
        "A resistor of 10 Ω is connected to a 20 V battery. What is the current flowing?",
        "Three resistors of 2 Ω, 3 Ω, and 6 Ω are connected in parallel. What is the equivalent resistance?",
        "A current of 2 A flows through a resistor of 5 Ω for 10 seconds. What is the heat produced?",
        "A battery of emf 12 V and internal resistance 1 Ω is connected to a load of 5 Ω. What is the current?",
        "In a Wheatstone bridge, if three resistances are 2 Ω, 3 Ω, and 6 Ω, what should be the fourth resistance for balance?",
      ],
    },
    Chemistry: {
      "Periodic Trends": [
        "Which element has the highest ionization energy: Na, Mg, or Al?",
        "What is the trend of atomic radius across a period?",
        "Which element has the highest electronegativity: F, Cl, or Br?",
        "Arrange the following in order of increasing atomic radius: Li, Na, K, Rb",
        "What is the electron affinity trend in group 17?",
      ],
      "Chemical Bonding": [
        "What is the bond angle in a water molecule?",
        "What is the hybridization of carbon in methane?",
        "Which molecule has a linear geometry: CO₂, H₂O, or NH₃?",
        "What is the bond order in O₂ molecule?",
        "Which compound has the highest lattice energy: NaCl, MgCl₂, or AlCl₃?",
      ],
      "Organic Reactions": [
        "What is the major product when propene reacts with HBr in the presence of peroxide?",
        "What is the mechanism of SN2 reaction?",
        "Which compound undergoes E2 elimination faster: 2-bromobutane or 2-bromo-2-methylpropane?",
        "What is the product when benzene reacts with Cl₂ in the presence of FeCl₃?",
        "What is the major product of the reaction between ethene and H₂O in the presence of H₂SO₄?",
      ],
    },
    Mathematics: {
      "Complex Numbers": [
        "What is the value of (1 + i)⁴?",
        "If z = 3 + 4i, what is |z|?",
        "What is the argument of the complex number -1 + i?",
        "What are the cube roots of unity?",
        "If z₁ = 2 + 3i and z₂ = 1 - 2i, what is z₁ × z₂?",
      ],
      "Quadratic Equations": [
        "If the roots of x² - 5x + 6 = 0 are α and β, what is α + β?",
        "For what value of k does the equation x² + kx + 9 = 0 have equal roots?",
        "What is the sum of roots of the equation 2x² - 7x + 3 = 0?",
        "If one root of x² + px + q = 0 is twice the other, what is the relation between p and q?",
        "What is the discriminant of the equation 3x² - 2x + 1 = 0?",
      ],
      "Calculus": [
        "What is the derivative of x³ + 2x² - 5x + 1?",
        "What is the limit of (sin x)/x as x approaches 0?",
        "What is the integral of 3x² + 2x - 1?",
        "What is the derivative of e^(2x)?",
        "What is the limit of (x² - 4)/(x - 2) as x approaches 2?",
      ],
    },
  };

  // Try to find a template for the specific topic
  const subjectTemplates = questionTemplates[subject];
  if (subjectTemplates && subjectTemplates[topic]) {
    const templates = subjectTemplates[topic];
    const templateIndex = (index + subtopic.length) % templates.length;
    return templates[templateIndex] || `Question ${index + 1}: A problem related to ${subtopic} in ${topic}.`;
  }

  // Fallback: Generate a generic question based on subtopic
  const genericQuestions = [
    `Question ${index + 1}: Solve the following problem related to ${subtopic} in ${topic}.`,
    `Question ${index + 1}: Calculate the value based on ${subtopic} principles in ${topic}.`,
    `Question ${index + 1}: Analyze the following scenario involving ${subtopic} in ${topic}.`,
    `Question ${index + 1}: Apply the concepts of ${subtopic} to solve this ${topic} problem.`,
    `Question ${index + 1}: Determine the answer using ${subtopic} in the context of ${topic}.`,
  ];
  
  return genericQuestions[index % genericQuestions.length];
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

  const questionText = generateQuestionText(subject.name, topic.name, subtopic, index);

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
    "standard",
  ];

  return {
    type,
    subject: subject.name,
    chapter: chapter.name,
    topic: topic.name,
    subtopic,
    customId: `Q-${String(index + 1).padStart(3, "0")}`,
    tags,
    text: questionText,
    imageUrl: null,
    options,
    correctOptions,
    correctAnswer,
    explanation,
    marks: 4, // Fixed +4 marks
    penalty: 1, // Fixed -1 penalty
    difficulty,
  };
}

export default function AddQuestionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 180, message: "" });
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setProgress({ current: 0, total: 180, message: "Starting..." });
    setError(null);
    setCompleted(false);

    try {
      // Find Physics and Mathematics
      const physics = subjectsData.subjects.find((s) => s.name === "Physics");
      const mathematics = subjectsData.subjects.find((s) => s.name === "Mathematics");
      
      // Find Chemistry subjects (Inorganic, Organic, Physical)
      const inorganicChemistry = subjectsData.subjects.find((s) => s.name === "Inorganic Chemistry");
      const organicChemistry = subjectsData.subjects.find((s) => s.name === "Organic Chemistry");
      const physicalChemistry = subjectsData.subjects.find((s) => s.name === "Physical Chemistry");

      if (!physics || !mathematics) {
        throw new Error("Physics or Mathematics not found in data.");
      }

      if (!inorganicChemistry && !organicChemistry && !physicalChemistry) {
        throw new Error("Chemistry subjects (Inorganic/Organic/Physical) not found in data.");
      }

      const allQuestions: QuestionInput[] = [];
      let questionIndex = 0;

      // Helper function to generate questions for a subject (same schema as form)
      const generateQuestionsForSubject = (
        subjectData: any,
        count: number,
        subjectName: string,
        chapterName?: string // Optional: if provided, use this as chapter name instead of subject's chapter name
      ) => {
        const chapters = subjectData.chapters || [];
        
        // Collect all topics and subtopics
        const topicSubtopicPairs: Array<{ chapter: any; topic: any; subtopic: string }> = [];
        chapters.forEach((chapter) => {
          chapter.topics?.forEach((topic: any) => {
            topic.subtopics?.forEach((subtopic: string) => {
              // If chapterName is provided, use it; otherwise use the chapter's name
              const finalChapterName = chapterName || chapter.name;
              topicSubtopicPairs.push({ 
                chapter: { ...chapter, name: finalChapterName }, 
                topic, 
                subtopic 
              });
            });
          });
        });

        if (topicSubtopicPairs.length === 0) {
          console.warn(`No topics/subtopics found for ${subjectName}`);
          return;
        }

        // Generate questions distributed across topics/subtopics
        for (let i = 0; i < count; i++) {
          const pair = topicSubtopicPairs[i % topicSubtopicPairs.length];
          // Create a subject object with the correct name for the question
          const questionSubject = { ...subjectData, name: subjectName };
          const question = generateQuestion(questionIndex, questionSubject, pair.chapter, pair.topic, pair.subtopic);
          allQuestions.push(question);
          questionIndex++;
        }
      };

      // Generate 60 questions for Physics
      generateQuestionsForSubject(physics, 60, "Physics");

      // Generate 60 questions for Chemistry
      // Treat Inorganic, Organic, Physical as chapters under "Chemistry" subject
      const chemistryChapters = [];
      if (inorganicChemistry) chemistryChapters.push({ data: inorganicChemistry, name: "Inorganic" });
      if (organicChemistry) chemistryChapters.push({ data: organicChemistry, name: "Organic" });
      if (physicalChemistry) chemistryChapters.push({ data: physicalChemistry, name: "Physical" });

      if (chemistryChapters.length === 0) {
        throw new Error("No Chemistry chapters found.");
      }

      // Distribute 60 questions across Chemistry chapters (20 each if 3 exist, 30 each if 2 exist, 60 if 1 exists)
      const questionsPerChemistryChapter = Math.floor(60 / chemistryChapters.length);
      const remainder = 60 % chemistryChapters.length;

      chemistryChapters.forEach((chemChapter, index) => {
        const count = questionsPerChemistryChapter + (index < remainder ? 1 : 0);
        generateQuestionsForSubject(chemChapter.data, count, "Chemistry", chemChapter.name);
      });

      // Generate 60 questions for Mathematics
      generateQuestionsForSubject(mathematics, 60, "Mathematics");

      // Add questions to database
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < allQuestions.length; i++) {
        try {
          setProgress({
            current: i + 1,
            total: allQuestions.length,
            message: `Adding question ${i + 1}/${allQuestions.length}: ${allQuestions[i].customId}...`,
          });

          await createQuestion(allQuestions[i], user.uid);
          successCount++;

          // Small delay to avoid overwhelming the database
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`Error adding question ${i + 1}:`, err);
          failCount++;
        }
      }

      setProgress({
        current: allQuestions.length,
        total: allQuestions.length,
        message: `Completed! Successfully added ${successCount} questions. ${failCount > 0 ? `${failCount} failed.` : ""}`,
      });
      setCompleted(true);
    } catch (err) {
      console.error("[AddQuestionsPage] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to add questions.");
      setProgress({ current: 0, total: 180, message: "Error occurred." });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg p-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Add 180 Standard Questions</h1>
          <p className="text-sm text-gray-600 mb-6">
            This will add 180 questions (60 each for Physics, Chemistry, and Mathematics) with +4/-1 marking scheme.
            <br />
            <span className="text-xs text-gray-500 mt-1 block">
              Chemistry includes Inorganic, Organic, and Physical as chapters. Questions follow the same schema as the Add Question form.
            </span>
          </p>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {completed && !error && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{progress.message}</p>
            </div>
          )}

          {!completed && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm text-gray-600">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              {progress.message && (
                <p className="text-xs text-gray-600 mt-2">{progress.message}</p>
              )}
            </div>
          )}

          <button
            onClick={handleAddQuestions}
            disabled={adding}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
              adding
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {adding ? "Adding Questions..." : "Add 180 Questions to Database"}
          </button>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-sm font-semibold text-blue-900 mb-2">Question Details:</h2>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• 60 questions each for Physics, Chemistry, and Mathematics</li>
              <li>• Chemistry includes Inorganic, Organic, and Physical as chapters</li>
              <li>• All questions have proper subject, chapter, topic, and subtopic (same schema as Add Question form)</li>
              <li>• Marking scheme: +4 marks for correct, -1 mark for incorrect</li>
              <li>• Questions include MCQ (single & multiple) and Numerical types</li>
              <li>• Questions are distributed across various topics and subtopics</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

