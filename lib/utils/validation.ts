// lib/utils/validation.ts

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

/**
 * Sanitize string input (basic XSS prevention)
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, "");
}

/**
 * Validate phone number format (basic validation)
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove spaces, dashes, and parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  // Check if it starts with + and has 10-15 digits after country code
  // Or if it's a 10-digit number (for countries without + prefix)
  const phoneRegex = /^(\+?\d{1,3})?\d{10,15}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Format phone number for Firebase (adds + if not present)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  // If it doesn't start with +, assume it's a local number and add +
  // You may want to adjust this based on your default country code
  if (!cleaned.startsWith("+")) {
    // Default to +91 for India, adjust as needed
    return `+91${cleaned}`;
  }
  return cleaned;
}



























