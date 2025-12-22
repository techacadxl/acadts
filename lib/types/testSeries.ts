// lib/types/testSeries.ts
import type { Timestamp } from "firebase/firestore";

export interface TestSeriesDoc {
  title: string;
  description: string;
  thumbnail?: string; // URL to thumbnail image (optional for now)
  testIds: string[]; // Array of test document IDs
  price?: number; // Price in the base currency (e.g., USD) - optional for backward compatibility
  isPublished?: boolean; // Whether the test series is published and visible to students
  mode?: "online" | "offline"; // Course delivery mode
  discount?: number; // Discount percentage
  originalPrice?: number; // Original price before discount
  startDate?: Timestamp; // Course start date
  endDate?: Timestamp; // Course end date
  targetClass?: string; // Target class/grade (e.g., "11th", "12th", "Dropper")
  whatsappLink?: string; // WhatsApp group link
  telegramLink?: string; // Telegram group link
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
  mode?: "online" | "offline";
  discount?: number;
  originalPrice?: number;
  startDate?: Timestamp;
  endDate?: Timestamp;
  targetClass?: string;
  whatsappLink?: string;
  telegramLink?: string;
}



