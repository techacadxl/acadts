// scripts/add-demo-questions.ts
// Script to add 180 demo questions to Firestore
// Run with: npx tsx scripts/add-demo-questions.ts

import { createQuestion } from "@/lib/db/questions";
import type { QuestionInput, QuestionType, DifficultyLevel } from "@/lib/types/question";
import subjectsData from "@/lib/data/subjects.json";

// Helper to get random element from array
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to get random number in range
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate a question based on subject structure
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
    "Periodic Trends": [
      "Which element has the highest ionization energy: Li, Na, or K?",
      "What is the trend of atomic radius across a period?",
      "Which element has the highest electronegativity: F, Cl, or Br?",
    ],
    "Chemical Bonding": [
      "What is the bond angle in a water molecule?",
      "Which type of hybridization is present in methane?",
      "What is the shape of a molecule with sp³ hybridization?",
    ],
    "Organic Reactions": [
      "What is the product when ethene reacts with HBr?",
      "Which mechanism does tertiary alkyl halide follow in substitution reaction?",
      "What is the major product in the addition of H₂O to propene?",
    ],
    "Equilibrium": [
      "For the reaction N₂ + 3H₂ ⇌ 2NH₃, if Kc = 4, what is the value of Kp at 400 K?",
      "What happens to the equilibrium when pressure is increased for the reaction 2NO₂ ⇌ N₂O₄?",
      "If Q < K for a reaction, in which direction will it proceed?",
    ],
  };

  // Default question templates
  const defaultQuestions = [
    `Question ${index + 1}: A problem related to ${subtopic} in ${topic.name}.`,
    `Question ${index + 1}: Calculate the value based on ${subtopic} principles.`,
    `Question ${index + 1}: Analyze the following scenario in ${subtopic}.`,
  ];

  const topicKey = topic.name;
  const availableQuestions = questionTexts[topicKey] || defaultQuestions;
  const text = availableQuestions[index % availableQuestions.length] || defaultQuestions[0];

  // Generate options for MCQ
  let options: string[] | undefined;
  let correctOptions: number[] | undefined;
  let correctAnswer: string | null = null;

  if (type === "mcq_single" || type === "mcq_multiple") {
    options = [
      `${randomInt(1, 100)}`,
      `${randomInt(1, 100)}`,
      `${randomInt(1, 100)}`,
      `${randomInt(1, 100)}`,
    ];
    
    if (type === "mcq_single") {
      correctOptions = [randomInt(0, 3)];
    } else {
      // Multiple correct - select 2 random options
      const indices = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2);
      correctOptions = indices.sort((a, b) => a - b);
    }
  } else {
    // Numerical
    correctAnswer = `${randomInt(1, 1000)}`;
  }

  // Generate explanation
  const explanation = `This question tests understanding of ${subtopic} in ${topic.name}. The correct approach involves applying the fundamental principles and formulas related to this topic.`;

  // Generate tags
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

async function addDemoQuestions(adminUid: string) {
  console.log("Starting to add 180 demo questions...");
  console.log("Admin UID:", adminUid);

  const questions: QuestionInput[] = [];
  let questionIndex = 0;

  // Iterate through subjects, chapters, topics, and subtopics
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

  // If we need more questions, fill with random selections
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

  console.log(`Generated ${questions.length} questions. Adding to database...`);

  // Add questions in batches to avoid overwhelming Firestore
  const batchSize = 10;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    console.log(`Adding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(questions.length / batchSize)}...`);

    await Promise.all(
      batch.map(async (question, idx) => {
        try {
          await createQuestion(question, adminUid);
          successCount++;
          if ((i + idx + 1) % 20 === 0) {
            console.log(`Added ${i + idx + 1}/${questions.length} questions...`);
          }
        } catch (error) {
          errorCount++;
          console.error(`Error adding question ${i + idx + 1}:`, error);
        }
      })
    );

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < questions.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total questions: ${questions.length}`);
  console.log(`Successfully added: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log("\nDone! Questions are now available in the admin panel.");
}

// Main execution
const adminUid = process.argv[2];

if (!adminUid) {
  console.error("Error: Admin UID is required");
  console.log("Usage: npx tsx scripts/add-demo-questions.ts <ADMIN_UID>");
  console.log("\nTo get your admin UID:");
  console.log("1. Log in as admin in your app");
  console.log("2. Check the browser console for your user UID");
  console.log("3. Or check Firebase Console > Authentication > Users");
  process.exit(1);
}

addDemoQuestions(adminUid)
  .then(() => {
    console.log("Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });

