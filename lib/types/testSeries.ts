// lib/types/testSeries.ts
import type { Timestamp } from "firebase/firestore";

export interface TestSeriesDoc {
  title: string;
  description: string;
  thumbnail?: string; // URL to thumbnail image (optional for now)
  testIds: string[]; // Array of test document IDs
  price?: number; // Price in the base currency (e.g., USD) - optional for backward compatibility
  isPublished?: boolean; // Whether the test series is published and visible to students
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // Admin UID
}

export interface TestSeries extends TestSeriesDoc {
  id: string;
}

export interface TestSeriesInput {
  title: string;
  description: string;
  thumbnail?: string;
  testIds: string[];
  price: number;
  isPublished?: boolean;
}



