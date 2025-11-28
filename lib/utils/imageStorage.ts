// lib/utils/imageStorage.ts
/**
 * Professional image storage solution using Firebase only
 * Supports: Firebase Storage (free tier) and Base64 (Firestore fallback)
 * 
 * Firebase Storage Free Tier (Spark Plan):
 * - 5GB storage
 * - 1GB/day downloads
 * - 20K uploads/day
 * - No credit card required
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import { auth } from "@/lib/firebase/client";

export interface ImageUploadResult {
  url: string;
  provider: 'firebase' | 'base64';
  size?: number;
}

export interface ImageStorageConfig {
  provider: 'firebase' | 'base64' | 'auto';
  folder?: string;
}

/**
 * Upload image using Firebase Storage (Free tier: 5GB storage, 1GB/day downloads)
 * Professional and scalable - works with Firebase Spark (free) plan
 */
async function uploadToFirebaseStorage(
  file: File,
  folder: string = "questions"
): Promise<ImageUploadResult> {
  // Check if user is authenticated
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be logged in to upload images. Please log in and try again.");
  }

  console.log("[ImageStorage] Uploading to Firebase Storage:", {
    userId: currentUser.uid,
    fileName: file.name,
    size: file.size,
  });

  try {
    // Generate unique file name
    const timestamp = Date.now();
    const fileExtension = file.name.split(".").pop() || "jpg";
    const fileName = `image-${timestamp}.${fileExtension}`;
    const storagePath = `${folder}/${fileName}`;

    // Create storage reference
    const storageRef = ref(storage, storagePath);

    // Upload file with metadata
    console.log("[ImageStorage] Uploading to path:", storagePath);
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
      cacheControl: "public, max-age=31536000", // 1 year cache
      customMetadata: {
        uploadedBy: currentUser.uid,
        uploadedAt: new Date().toISOString(),
      },
    });

    console.log("[ImageStorage] Upload successful, getting download URL");
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log("[ImageStorage] Image uploaded successfully:", {
      url: downloadURL,
      path: snapshot.ref.fullPath,
      size: snapshot.metadata.size,
    });

    return {
      url: downloadURL,
      provider: 'firebase',
      size: parseInt(snapshot.metadata.size || '0', 10),
    };
  } catch (error) {
    console.error("[ImageStorage] Firebase Storage upload error:", error);
    
    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes("permission") || error.message.includes("unauthorized")) {
        throw new Error(
          "Permission denied. Please check Firebase Storage security rules. " +
          "Make sure authenticated users can upload to the 'questions' folder. " +
          "See FIREBASE_STORAGE_SETUP.md for instructions."
        );
      }
      if (error.message.includes("CORS") || error.message.includes("preflight")) {
        throw new Error(
          "CORS error: Firebase Storage security rules may be blocking the upload. " +
          "Please configure Storage rules to allow authenticated uploads. " +
          "See FIREBASE_STORAGE_SETUP.md for instructions."
        );
      }
      if (error.message.includes("quota") || error.message.includes("limit")) {
        throw new Error(
          "Storage quota exceeded. Firebase free tier allows 5GB storage. " +
          "Consider using base64 storage for smaller images or upgrade your plan."
        );
      }
      throw error;
    }
    
    throw new Error("Failed to upload image to Firebase Storage. Please try again.");
  }
}

/**
 * Convert image to base64 and store in Firestore
 * Free fallback option - best for small images (< 500KB)
 * Note: Base64 images are stored directly in Firestore documents
 */
async function uploadAsBase64(file: File): Promise<ImageUploadResult> {
  return new Promise((resolve, reject) => {
    // Validate size (Firestore document limit is 1MB, so we'll limit to 500KB for safety)
    const maxSize = 500 * 1024; // 500KB
    if (file.size > maxSize) {
      reject(new Error(
        `Image too large for base64 storage. Maximum size is 500KB. ` +
        `Your image is ${(file.size / 1024).toFixed(0)}KB. ` +
        `Please compress the image or use Firebase Storage for larger files.`
      ));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve({
        url: base64String,
        provider: 'base64',
        size: file.size,
      });
    };
    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Main upload function - uses base64 by default (completely free, no Storage needed)
 * Base64 images are stored directly in Firestore documents
 */
export async function uploadImage(
  file: File,
  config: ImageStorageConfig = { provider: 'base64' }
): Promise<ImageUploadResult> {
  console.log('[ImageStorage] Uploading image:', {
    name: file.name,
    size: file.size,
    type: file.type,
    provider: config.provider,
  });

  // Validate file type
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!validImageTypes.includes(file.type)) {
    throw new Error(
      `Invalid file type. Allowed types: ${validImageTypes.map(t => t.split('/')[1]).join(', ')}`
    );
  }

  // Validate file size (500KB max for base64 - Firestore document limit is 1MB)
  const maxSize = 500 * 1024; // 500KB
  if (file.size > maxSize) {
    throw new Error(
      `File size exceeds 500KB limit. Your image is ${(file.size / 1024).toFixed(0)}KB. ` +
      `Please compress the image. Recommended: Use online tools like TinyPNG or Squoosh to compress images.`
    );
  }

  try {
    // Auto mode: Use base64 (completely free, no Storage needed)
    if (config.provider === 'auto' || config.provider === 'base64') {
      console.log('[ImageStorage] Using Base64 storage (completely free, stored in Firestore)');
      return await uploadAsBase64(file);
    }

    // Firebase Storage option (requires Blaze plan)
    if (config.provider === 'firebase') {
      console.log('[ImageStorage] Using Firebase Storage (requires Blaze plan)');
      return await uploadToFirebaseStorage(file, config.folder);
    }

    throw new Error(`Unknown provider: ${config.provider}`);
  } catch (error) {
    console.error('[ImageStorage] Upload error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to upload image. Please try again.');
  }
}

/**
 * Delete image from Firebase Storage
 * Base64 images are stored in Firestore, deletion happens when document is deleted
 */
export async function deleteImage(
  imageUrl: string,
  provider: 'firebase' | 'base64' | 'auto' = 'auto'
): Promise<void> {
  // Base64 images are stored in Firestore, deletion happens when document is deleted
  if (provider === 'base64' || imageUrl.startsWith('data:')) {
    console.log('[ImageStorage] Base64 image - no deletion needed (stored in Firestore)');
    return;
  }

  // Detect provider from URL if auto
  if (provider === 'auto') {
    if (imageUrl.startsWith('data:')) {
      console.log('[ImageStorage] Base64 image detected - no deletion needed');
      return;
    }
    if (imageUrl.includes('firebasestorage.googleapis.com') || imageUrl.includes('firebase')) {
      provider = 'firebase';
    } else {
      console.warn('[ImageStorage] Unknown image provider, skipping deletion');
      return;
    }
  }

  // Firebase Storage deletion
  if (provider === 'firebase') {
    try {
      // Extract path from URL if full URL is provided
      let storagePath = imageUrl;
      if (imageUrl.includes('/o/')) {
        // Firebase Storage URL format: https://firebasestorage.googleapis.com/v0/b/.../o/path%2Fto%2Ffile?alt=media
        const urlParts = imageUrl.split('/o/');
        if (urlParts.length > 1) {
          const pathPart = urlParts[1].split('?')[0];
          storagePath = decodeURIComponent(pathPart);
        }
      }

      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
      console.log('[ImageStorage] Image deleted successfully from Firebase Storage:', storagePath);
    } catch (error) {
      // If image doesn't exist, log but don't throw (idempotent delete)
      if (error instanceof Error && error.message.includes('not found')) {
        console.warn('[ImageStorage] Image not found in Firebase Storage, skipping delete:', imageUrl);
        return;
      }
      const deleteError =
        error instanceof Error
          ? error
          : new Error('Failed to delete image from Firebase Storage');
      console.error('[ImageStorage] Error deleting image:', deleteError);
      throw deleteError;
    }
  }
}

/**
 * Get image storage configuration
 * Default: Base64 (completely free, no Storage plan needed)
 */
export function getImageStorageConfig(): ImageStorageConfig {
  // Use base64 by default - completely free, no Storage plan needed
  // Images are stored directly in Firestore documents
  return {
    provider: 'base64', // Completely free, no upgrade needed
    folder: 'questions',
  };
}

/**
 * Validate image file before upload
 */
export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 500 * 1024; // 500KB for base64 storage (Firestore document limit)

  if (!validImageTypes.includes(file.type)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed: ${validImageTypes.map(t => t.split('/')[1]).join(', ')}`,
    };
  }

  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size exceeds 500KB limit. Your image is ${(file.size / 1024).toFixed(0)}KB. Please compress the image using tools like TinyPNG or Squoosh.`,
    };
  }

  return { isValid: true };
}

