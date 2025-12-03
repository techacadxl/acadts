// app/(auth)/login/page.tsx
"use client";

import { FormEvent, useState, useCallback } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAuthErrorMessage } from "@/lib/utils/errors";
import { isValidEmail } from "@/lib/utils/validation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      console.log("[LoginPage] Form submitted, attempting login");
      
      // Client-side validation
      if (!isValidEmail(email)) {
        setError("Please enter a valid email address.");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }

      setError(null);
      setSubmitting(true);

      try {
        console.log("[LoginPage] Calling signInWithEmailAndPassword for:", email);
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        console.log("[LoginPage] Login successful:", {
          userId: userCredential.user.uid,
          email: userCredential.user.email,
        });
        console.log("[LoginPage] Redirecting to dashboard");
        router.push("/dashboard");
      } catch (err) {
        console.error("[LoginPage] Login error:", err);
        const errorMessage = getAuthErrorMessage(err);
        console.log("[LoginPage] Error message:", errorMessage);
        setError(errorMessage);
      } finally {
        console.log("[LoginPage] Login attempt completed, setting submitting to false");
        setSubmitting(false);
      }
    },
    [email, password, router]
  );

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md border-2 border-[#ff6b35] rounded-lg p-8 shadow-2xl bg-white">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">
          Log in
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full border-2 border-gray-300 bg-white text-gray-900 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-[#ff6b35] transition-all placeholder:text-gray-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "error-message" : undefined}
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full border-2 border-gray-300 bg-white text-gray-900 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-[#ff6b35] transition-all placeholder:text-gray-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Enter your password"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "error-message" : undefined}
            />
          </div>

          {error && (
            <div
              id="error-message"
              className="text-sm text-red-600 bg-red-50 border-2 border-red-500 rounded-lg p-3"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#ff6b35] hover:bg-yellow-400 text-white py-3 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-black transform hover:scale-105 shadow-lg"
            aria-label={submitting ? "Logging in..." : "Log in"}
          >
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-center text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-[#ff6b35] hover:text-yellow-400 underline font-medium focus:outline-none focus:ring-2 focus:ring-[#ff6b35] rounded transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
