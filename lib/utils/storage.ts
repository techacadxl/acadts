// lib/utils/storage.ts
/**
 * @deprecated Use imageStorage.ts instead for free image hosting
 * This file is kept for backward compatibility or if Firebase Storage is upgraded
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { auth } from "@/lib/firebase/client";

export interface UploadImageResult {
  url: string;
  path: string;
}

/**
 * Upload an image file to Firebase Storage
 * @param file - Image file to upload
 * @param folder - Folder path in storage (e.g., "questions")
 * @param fileName - Optional custom file name (without extension)
 * @returns Promise with download URL and storage path
 */
export async function uploadImage(
  file: File,
  folder: string = "questions",
  fileName?: string
): Promise<UploadImageResult> {
  console.log("[Storage] Uploading image:", {
    fileName: file.name,
    size: file.size,
    type: file.type,
    folder,
  });

  // Check if user is authenticated
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const error = new Error("You must be logged in to upload images. Please log in and try again.");
    console.error("[Storage] Authentication error:", error);
    throw error;
  }

  console.log("[Storage] User authenticated:", currentUser.uid);

  // Validate file type
  const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  if (!validImageTypes.includes(file.type)) {
    throw new Error(
      `Invalid file type. Allowed types: ${validImageTypes.join(", ")}`
    );
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error("File size exceeds 5MB limit. Please compress the image.");
  }

  try {
    // Generate unique file name if not provided
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop() || "jpg";
    const finalFileName = fileName
      ? `${fileName}-${timestamp}.${fileExtension}`
      : `image-${timestamp}.${fileExtension}`;

    // Create storage reference
    const storageRef = ref(storage, `${folder}/${finalFileName}`);

    // Upload file
    console.log("[Storage] Uploading to path:", `${folder}/${finalFileName}`);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      cacheControl: "public, max-age=31536000", // 1 year cache
    });

    console.log("[Storage] Upload successful, getting download URL");
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log("[Storage] Image uploaded successfully:", {
      url: downloadURL,
      path: snapshot.ref.fullPath,
    });

    return {
      url: downloadURL,
      path: snapshot.ref.fullPath,
    };
  } catch (error) {
    console.error("[Storage] Error uploading image:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      // Check for common Firebase Storage errors
      if (error.message.includes("permission") || error.message.includes("unauthorized")) {
        throw new Error(
          "Permission denied. Please check Firebase Storage security rules. " +
          "Make sure authenticated users can upload to the 'questions' folder."
        );
      }
      if (error.message.includes("CORS") || error.message.includes("preflight")) {
        throw new Error(
          "CORS error: Firebase Storage security rules may be blocking the upload. " +
          "Please configure Storage rules to allow authenticated uploads."
        );
      }
      if (error.message.includes("network") || error.message.includes("failed")) {
        throw new Error(
          "Network error: Could not connect to Firebase Storage. " +
          "Please check your internet connection and try again."
        );
      }
      throw error;
    }
    
    throw new Error("Failed to upload image to Firebase Storage. Please try again.");
  }
}

/**
 * Delete an image from Firebase Storage
 * @param imageUrl - Full URL or storage path of the image to delete
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  console.log("[Storage] Deleting image:", imageUrl);

  try {
    // Extract path from URL if full URL is provided
    let storagePath = imageUrl;
    if (imageUrl.includes("/o/")) {
      // Firebase Storage URL format: https://firebasestorage.googleapis.com/v0/b/.../o/path%2Fto%2Ffile?alt=media
      const urlParts = imageUrl.split("/o/");
      if (urlParts.length > 1) {
        const pathPart = urlParts[1].split("?")[0];
        storagePath = decodeURIComponent(pathPart);
      }
    }

    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    console.log("[Storage] Image deleted successfully:", storagePath);
  } catch (error) {
    // If image doesn't exist, log but don't throw (idempotent delete)
    if (error instanceof Error && error.message.includes("not found")) {
      console.warn("[Storage] Image not found, skipping delete:", imageUrl);
      return;
    }
    const deleteError =
      error instanceof Error
        ? error
        : new Error("Failed to delete image from Firebase Storage");
    console.error("[Storage] Error deleting image:", deleteError);
    throw deleteError;
  }
}

/**
 * Validate image file before upload
 * @param file - File to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  const validImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validImageTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed: ${validImageTypes.map((t) => t.split("/")[1]).join(", ")}`,
    };
  }

  if (file.size > maxSize) {
    return {
      isValid: false,
      error: "File size exceeds 5MB. Please compress the image.",
    };
  }

  return { isValid: true };
}

