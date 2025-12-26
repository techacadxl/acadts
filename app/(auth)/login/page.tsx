// app/(auth)/login/page.tsx
"use client";

import { FormEvent, useState, useCallback, useEffect, useRef } from "react";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import Link from "next/link";
import { getAuthErrorMessage } from "@/lib/utils/errors";
import { isValidEmail, isValidPhoneNumber, formatPhoneNumber } from "@/lib/utils/validation";
import { createUserDocument } from "@/lib/db/users";

type AuthMethod = "email" | "phone" | "google";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [authMethod, setAuthMethod] = useState<AuthMethod>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Track client-side mounting to prevent hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize reCAPTCHA when phone auth is selected (client-side only)
  useEffect(() => {
    if (!isClient) return;
    
    if (authMethod === "phone") {
      // Clean up previous verifier
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }

      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const container = document.getElementById("recaptcha-container");
        if (!container) return;

        const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "normal",
          callback: () => {
            // reCAPTCHA solved
          },
          "expired-callback": () => {
            setError("reCAPTCHA expired. Please try again.");
          },
        });

        recaptchaVerifierRef.current = verifier;
      }, 100);

      return () => {
        clearTimeout(timer);
        if (recaptchaVerifierRef.current) {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        }
      };
    } else {
      // Clean up when switching away from phone auth
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    }
  }, [authMethod, isClient]);

  // Redirect if already logged in
  useEffect(() => {
    if (authLoading || profileLoading) return;
    
    if (user) {
      if (role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, role, authLoading, profileLoading, router]);

  const handleEmailLogin = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      console.log("[LoginPage] Email login form submitted");
      
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
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        console.log("[LoginPage] Email login successful:", {
          userId: userCredential.user.uid,
          email: userCredential.user.email,
        });
        
        if (typeof window !== "undefined") {
          localStorage.setItem("user_login_time", Date.now().toString());
        }
        
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase/client");
        const userRef = doc(db, "users", userCredential.user.uid);
        const userSnap = await getDoc(userRef);
        const userRole = userSnap.exists() ? (userSnap.data()?.role || "student") : "student";
        
        if (userRole === "admin") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("[LoginPage] Email login error:", err);
        setError(getAuthErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, router]
  );

  const handleGoogleLogin = useCallback(async () => {
    setError(null);
    setSubmitting(true);

    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      console.log("[LoginPage] Google login successful:", {
        userId: userCredential.user.uid,
        email: userCredential.user.email,
      });

      // Create or update user document
      await createUserDocument({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        phoneNumber: userCredential.user.phoneNumber,
        displayName: userCredential.user.displayName,
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("user_login_time", Date.now().toString());
      }

      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase/client");
      const userRef = doc(db, "users", userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      const userRole = userSnap.exists() ? (userSnap.data()?.role || "student") : "student";

      if (userRole === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("[LoginPage] Google login error:", err);
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [router]);

  const handlePhoneLogin = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      console.log("[LoginPage] Phone login form submitted");

      if (!confirmationResult) {
        // Step 1: Send OTP
        if (!isValidPhoneNumber(phoneNumber)) {
          setError("Please enter a valid phone number.");
          return;
        }

        if (!recaptchaVerifierRef.current) {
          setError("reCAPTCHA not initialized. Please refresh the page.");
          return;
        }

        setError(null);
        setSubmitting(true);

        try {
          const formattedPhone = formatPhoneNumber(phoneNumber);
          const confirmation = await signInWithPhoneNumber(
            auth,
            formattedPhone,
            recaptchaVerifierRef.current
          );
          setConfirmationResult(confirmation);
          console.log("[LoginPage] OTP sent to:", formattedPhone);
        } catch (err) {
          console.error("[LoginPage] Phone auth error:", err);
          setError(getAuthErrorMessage(err));
          if (recaptchaVerifierRef.current) {
            recaptchaVerifierRef.current.clear();
            recaptchaVerifierRef.current = null;
          }
        } finally {
          setSubmitting(false);
        }
      } else {
        // Step 2: Verify OTP
        if (otp.length !== 6) {
          setError("Please enter the 6-digit OTP.");
          return;
        }

        setError(null);
        setSubmitting(true);

        try {
          const userCredential = await confirmationResult.confirm(otp);
          console.log("[LoginPage] Phone login successful:", {
            userId: userCredential.user.uid,
            phoneNumber: userCredential.user.phoneNumber,
          });

          // Create or update user document
          await createUserDocument({
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            phoneNumber: userCredential.user.phoneNumber,
            displayName: userCredential.user.displayName,
          });

          if (typeof window !== "undefined") {
            localStorage.setItem("user_login_time", Date.now().toString());
          }

          const { doc, getDoc } = await import("firebase/firestore");
          const { db } = await import("@/lib/firebase/client");
          const userRef = doc(db, "users", userCredential.user.uid);
          const userSnap = await getDoc(userRef);
          const userRole = userSnap.exists() ? (userSnap.data()?.role || "student") : "student";

          if (userRole === "admin") {
            router.push("/admin");
          } else {
            router.push("/dashboard");
          }
        } catch (err) {
          console.error("[LoginPage] OTP verification error:", err);
          setError(getAuthErrorMessage(err));
        } finally {
          setSubmitting(false);
        }
      }
    },
    [phoneNumber, otp, confirmationResult, router]
  );

  // Show loading state while checking auth
  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white p-4">
        <p className="text-gray-600">Checking session...</p>
      </main>
    );
  }

  // If already logged in, show redirect message
  if (user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white p-4">
        <p className="text-gray-600">You are already logged in. Redirecting...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md border-2 border-[#ff6b35] rounded-lg p-8 shadow-2xl bg-white">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">
          Log in
        </h1>

        {/* Auth Method Tabs */}
        <div className="flex gap-2 mb-6 border-b-2 border-gray-200">
          <button
            type="button"
            onClick={() => {
              setAuthMethod("email");
              setError(null);
              setConfirmationResult(null);
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              authMethod === "email"
                ? "text-[#ff6b35] border-b-2 border-[#ff6b35]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod("phone");
              setError(null);
              setConfirmationResult(null);
              setOtp("");
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              authMethod === "phone"
                ? "text-[#ff6b35] border-b-2 border-[#ff6b35]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Phone
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod("google");
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              authMethod === "google"
                ? "text-[#ff6b35] border-b-2 border-[#ff6b35]"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Google
          </button>
        </div>

        {error && (
          <div
            className="text-sm text-red-600 bg-red-50 border-2 border-red-500 rounded-lg p-3 mb-5"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Email/Password Form */}
        {authMethod === "email" && (
          <form onSubmit={handleEmailLogin} className="space-y-5" noValidate>
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
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#ff6b35] hover:bg-yellow-400 text-white py-3 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transform hover:scale-105 shadow-lg"
            >
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>
        )}

        {/* Phone/OTP Form */}
        {authMethod === "phone" && (
          <form onSubmit={handlePhoneLogin} className="space-y-5" noValidate>
            {!confirmationResult ? (
              <>
                <div>
                  <label htmlFor="phone" className="block mb-2 text-sm font-medium text-gray-700">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    className="w-full border-2 border-gray-300 bg-white text-gray-900 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-[#ff6b35] transition-all placeholder:text-gray-400"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    placeholder="Enter your phone number (e.g., +1234567890)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Include country code (e.g., +91 for India)
                  </p>
                </div>

                {isClient && <div id="recaptcha-container"></div>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#ff6b35] hover:bg-yellow-400 text-white py-3 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transform hover:scale-105 shadow-lg"
                >
                  {submitting ? "Sending OTP..." : "Send OTP"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="otp" className="block mb-2 text-sm font-medium text-gray-700">
                    Enter OTP
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="w-full border-2 border-gray-300 bg-white text-gray-900 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-[#ff6b35] transition-all placeholder:text-gray-400 text-center text-2xl tracking-widest"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                    placeholder="000000"
                  />
                  <p className="mt-1 text-xs text-gray-500 text-center">
                    Enter the 6-digit code sent to {phoneNumber}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#ff6b35] hover:bg-yellow-400 text-white py-3 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 transform hover:scale-105 shadow-lg"
                >
                  {submitting ? "Verifying..." : "Verify OTP"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmationResult(null);
                    setOtp("");
                    if (recaptchaVerifierRef.current) {
                      recaptchaVerifierRef.current.clear();
                      recaptchaVerifierRef.current = null;
                    }
                  }}
                  className="w-full text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Change phone number
                </button>
              </>
            )}
          </form>
        )}

        {/* Google Sign In */}
        {authMethod === "google" && (
          <div className="space-y-5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="w-full bg-white border-2 border-gray-300 hover:border-[#ff6b35] text-gray-900 py-3 rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#ff6b35] transform hover:scale-105 shadow-lg flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {submitting ? "Signing in..." : "Sign in with Google"}
            </button>
          </div>
        )}

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
