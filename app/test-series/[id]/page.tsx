// app/test-series/[id]/page.tsx
"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getTestSeriesById } from "@/lib/db/testSeries";
import { getTestById } from "@/lib/db/tests";
import type { TestSeries } from "@/lib/types/testSeries";
import type { Test } from "@/lib/types/test";
import Link from "next/link";

export default function TestSeriesDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const [testSeries, setTestSeries] = useState<TestSeries | null>(null);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  const seriesId = params.id as string;

  useEffect(() => {
    if (!seriesId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // First try to get from database
        let series = await getTestSeriesById(seriesId);
        
        // If not found, check for dummy data
        if (!series && typeof window !== 'undefined') {
          const dummyData = sessionStorage.getItem(`dummy-series-${seriesId}`);
          if (dummyData) {
            try {
              series = JSON.parse(dummyData) as TestSeries;
              console.log("[TestSeriesDetailsPage] Using dummy data for:", seriesId);
            } catch (error) {
              console.error("[TestSeriesDetailsPage] Error parsing dummy data:", error);
            }
          }
        }
        
        if (!series) {
          router.push("/");
          return;
        }

        setTestSeries(series);

        // Load test details
        if (series.testIds && series.testIds.length > 0) {
          const testPromises = series.testIds.map(async (testId) => {
            const test = await getTestById(testId);
            return test;
          });
          const loadedTests = await Promise.all(testPromises);
          setTests(loadedTests.filter((t): t is Test => t !== null));
        }
      } catch (error) {
        console.error("[TestSeriesDetailsPage] Error loading data:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [seriesId, router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-900 text-lg">Loading test series details...</p>
      </main>
    );
  }

  if (!testSeries) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-900 text-lg mb-4">Test series not found</p>
          <Link
            href="/"
            className="px-6 py-2 bg-[#ff6b35] hover:bg-yellow-400 text-white rounded-lg font-semibold transition-all inline-block"
          >
            Go Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const isFree = !testSeries.price || testSeries.price === 0;

  return (
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="bg-[#ff6b35] text-white px-4 md:px-8 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold hover:text-yellow-200 transition-colors">
            AcadXL
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-2 bg-white text-[#ff6b35] rounded hover:bg-yellow-50 transition-colors font-medium"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-white hover:text-yellow-200 transition-colors font-medium"
            >
              Signup
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 bg-white">
        {/* Back Button */}
        <Link
          href="/"
          className="mb-6 text-[#ff6b35] hover:text-yellow-400 flex items-center gap-2 transition-colors inline-block"
        >
          ← Back to Home
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Course Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-2xl p-6 md:p-8">
              {/* Title */}
              <h1 className="text-4xl font-bold text-gray-900 mb-6">{testSeries.title}</h1>

              {/* Status Badges */}
              <div className="flex gap-2 mb-6">
                <span className="bg-black text-white text-sm font-semibold px-4 py-2 rounded-full">
                  {isFree ? "FREE" : "PREMIUM"}
                </span>
                {!isFree && testSeries.price && (
                  <span className="bg-[#ff6b35] text-white text-sm font-semibold px-4 py-2 rounded-full">
                    ₹{testSeries.price.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">About the Test Series</h2>
                <p className="text-gray-700 leading-relaxed text-lg">{testSeries.description}</p>
              </div>

              {/* Course Details */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Course Details</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📅</span>
                    <div>
                      <p className="font-semibold text-gray-900">Course Duration</p>
                      <p className="text-gray-600">Available for lifetime access</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⭐</span>
                    <div>
                      <p className="font-semibold text-gray-900">Validity</p>
                      <p className="text-gray-600">Lifetime access to all content</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📹</span>
                    <div>
                      <p className="font-semibold text-gray-900">Mode of Tests</p>
                      <p className="text-gray-600">Online tests with instant results</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📚</span>
                    <div>
                      <p className="font-semibold text-gray-900">Subjects Covered</p>
                      <p className="text-gray-600">Complete syllabus coverage</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tests Included */}
              <div className="mb-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  Tests Included ({testSeries.testIds?.length || 0})
                </h2>
                {tests.length === 0 ? (
                  <p className="text-gray-600">No tests available in this series yet.</p>
                ) : (
                  <div className="space-y-3">
                    {tests.map((test) => (
                      <div
                        key={test.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-lg">{test.title}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                            {test.durationMinutes && <span>⏱️ {test.durationMinutes} minutes</span>}
                            {test.questions && <span>📝 {test.questions.length} Questions</span>}
                          </div>
                          {test.description && (
                            <p className="text-sm text-gray-600 mt-2">{test.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* What's Included */}
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">What's Included</h2>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl mt-1">✓</span>
                    <span className="text-gray-700 text-lg">
                      {testSeries.testIds?.length || 0} comprehensive tests covering all topics
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl mt-1">✓</span>
                    <span className="text-gray-700 text-lg">
                      Detailed solutions and explanations for all questions
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl mt-1">✓</span>
                    <span className="text-gray-700 text-lg">
                      Performance tracking and analytics
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 text-xl mt-1">✓</span>
                    <span className="text-gray-700 text-lg">
                      24/7 access to all tests and materials
                    </span>
                  </li>
                  {!isFree && (
                    <li className="flex items-start gap-3">
                      <span className="text-green-500 text-xl mt-1">✓</span>
                      <span className="text-gray-700 text-lg">
                        Priority support and doubt resolution
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Right Panel - Enrollment Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden sticky top-8">
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 text-white">
                <div className="text-xs font-semibold mb-2">ONLINE</div>
                <h2 className="text-3xl font-bold mb-2">{testSeries.title}</h2>
                <p className="text-sm opacity-90">Complete Test Series Package</p>
              </div>

              <div className="p-6">
                {/* Tags */}
                <div className="flex gap-2 mb-4">
                  {isFree && (
                    <span className="bg-yellow-400 text-gray-900 text-xs font-semibold px-3 py-1 rounded">
                      New
                    </span>
                  )}
                  <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1 rounded">
                    Online
                  </span>
                </div>

                {/* Audience */}
                <div className="flex items-center gap-2 mb-4 text-gray-700">
                  <span>👥</span>
                  <span className="text-sm">For All Students</span>
                </div>

                {/* Duration */}
                <div className="flex items-center gap-2 mb-4 text-gray-700">
                  <span>📅</span>
                  <span className="text-sm">Lifetime Access</span>
                </div>

                {/* Pricing */}
                <div className="mb-6 pt-4 border-t">
                  {!isFree && testSeries.price && (
                    <div className="mb-2">
                      <span className="text-sm text-gray-500 line-through">
                        ₹{(testSeries.price * 1.15).toFixed(0)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-bold text-blue-600">
                      {isFree ? "₹0" : `₹${(testSeries.price || 0).toLocaleString()}`}
                    </span>
                    <span className="text-sm text-gray-500">+ Taxes</span>
                  </div>
                  {!isFree && testSeries.price && (
                    <div className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-2 rounded flex items-center gap-2">
                      <span>🍃</span>
                      <span>Discount applied</span>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <Link
                  href="/dashboard"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-lg font-semibold text-lg transition-all text-center block"
                >
                  {isFree ? "Get Started Free" : "Continue with Test Series"}
                </Link>

                {/* Additional Info */}
                <p className="text-xs text-gray-500 text-center mt-4">
                  Click to enroll and access all tests
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

