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



























