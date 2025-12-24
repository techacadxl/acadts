"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { listPublishedTestSeries, listTestSeries } from "@/lib/db/testSeries";
import type { TestSeries } from "@/lib/types/testSeries";
import DescriptionRenderer from "@/components/DescriptionRenderer";

// Dummy test series data for home page
const DUMMY_TEST_SERIES: Record<string, Omit<TestSeries, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>> = {
  "JEE Ultimate Test Series": {
    title: "JEE Ultimate Test Series",
    description: "Comprehensive test series for JEE preparation with 50+ mock tests covering full syllabus. Includes detailed solutions, performance tracking, and 24/7 doubt resolution support.",
    price: 8499,
    testIds: [],
  },
  "NEET Complete Test Series": {
    title: "NEET Complete Test Series",
    description: "Complete NEET preparation package with 40+ high-quality mock tests. Includes video solutions, digital study material, and 1:1 mentorship guidance.",
    price: 6799,
    testIds: [],
  },
  "CBSE Board Test Series": {
    title: "CBSE Board Test Series",
    description: "Complete preparation package for CBSE board exams. Includes 30+ chapter-wise and full syllabus tests, previous year papers with solutions, and sample papers.",
    price: 4249,
    testIds: [],
  },
  "Foundation Test Series (1-year)": {
    title: "Foundation Test Series (1-year)",
    description: "Foundation level test series with 25+ comprehensive tests covering full syllabus. Includes digital material with 15000+ practice questions and detailed video solutions.",
    price: 5099,
    testIds: [],
  },
  "Foundation Test Series (2-year)": {
    title: "Foundation Test Series (2-year)",
    description: "Extended foundation test series with 50+ comprehensive tests. Includes digital material with 30000+ practice questions, complete video solutions library, and 2-year access.",
    price: 8499,
    testIds: [],
  },
  "Free Practice Test Series": {
    title: "Free Practice Test Series",
    description: "Basic test series with 10+ practice tests covering all topics. Includes detailed solutions, performance analytics, and 24/7 access to all tests.",
    price: 0,
    testIds: [],
  },
};

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [testSeriesList, setTestSeriesList] = useState<TestSeries[]>([]);
  const [loadingTestSeries, setLoadingTestSeries] = useState(true);

  // Redirect logged-in users to their appropriate dashboard
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

  // Load test series for display on home page (only published ones)
  useEffect(() => {
    const loadTestSeries = async () => {
      try {
        setLoadingTestSeries(true);
        const series = await listPublishedTestSeries();
        console.log("[HomePage] Loaded published test series:", series.length);
        setTestSeriesList(series);
      } catch (error) {
        console.error("[HomePage] Error loading test series:", error);
        setTestSeriesList([]);
      } finally {
        setLoadingTestSeries(false);
      }
    };
    loadTestSeries();
  }, []);

  const handleKnowMore = async (title: string) => {
    console.log("[HomePage] Know More clicked for:", title);
    
    let seriesToSearch = testSeriesList;
    
    // If test series list is empty, load it first
    if (testSeriesList.length === 0) {
      console.log("[HomePage] Test series list is empty, loading...");
      try {
        const series = await listTestSeries();
        setTestSeriesList(series);
        seriesToSearch = series;
      } catch (error) {
        console.error("[HomePage] Error loading test series:", error);
        alert("Unable to load test series. Please try again.");
        return;
      }
    }
    
    // Try to find matching test series by title
    const matchingSeries = seriesToSearch.find((series) => {
      const seriesTitle = series.title.toLowerCase().trim();
      const searchTitle = title.toLowerCase().trim();
      
      // Exact match
      if (seriesTitle === searchTitle) {
        return true;
      }
      
      // Contains match
      if (seriesTitle.includes(searchTitle) || searchTitle.includes(seriesTitle)) {
        return true;
      }
      
      // Word match
      const seriesWords = seriesTitle.split(/\s+/);
      const searchWords = searchTitle.split(/\s+/);
      const matchingWords = searchWords.filter(word => 
        seriesWords.some(sw => sw.includes(word) || word.includes(sw))
      );
      
      return matchingWords.length >= Math.min(2, searchWords.length);
    });
    
    if (matchingSeries && matchingSeries.id) {
      router.push(`/test-series/${matchingSeries.id}`);
    } else {
      // Use dummy data as fallback
      const dummyData = DUMMY_TEST_SERIES[title];
      if (dummyData) {
        const dummyId = title.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
        if (typeof window !== 'undefined') {
          const dummySeries: TestSeries = {
            id: dummyId,
            title: dummyData.title,
            description: dummyData.description,
            price: dummyData.price,
            testIds: dummyData.testIds || [],
            createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
            updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
            createdBy: 'system',
          };
          sessionStorage.setItem(`dummy-series-${dummyId}`, JSON.stringify(dummySeries));
        }
        router.push(`/test-series/${dummyId}`);
      } else {
        alert(`Test series "${title}" not found. Redirecting to dashboard.`);
        router.push("/dashboard");
      }
    }
  };

  // Show loading state while checking auth
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#ff6b35] border-t-transparent mb-4"></div>
          <p className="text-gray-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is logged in, show redirect message
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-700 font-medium">Redirecting to your dashboard...</p>
      </div>
    );
  }

  // Show landing page for non-logged-in users
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-orange-50/40 to-yellow-50/30">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#ff6b35] to-yellow-400 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <div className="text-xl font-bold text-gray-900">
                Acad<span className="text-[#ff6b35]">XL</span>
              </div>
            </div>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-[#ff6b35] transition-colors font-medium">
                About Us
              </a>
              <a href="#test-series" className="text-gray-700 hover:text-[#ff6b35] transition-colors font-medium">
                All Test Series
              </a>
            </div>
            
            {/* Login and Register Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/login")}
                className="px-6 py-2 bg-transparent border-2 border-[#ff6b35] text-[#ff6b35] rounded-lg hover:bg-[#ff6b35] hover:text-white transition-colors font-semibold"
              >
                Login
              </button>
              <button
                onClick={() => router.push("/register")}
                className="px-6 py-2 bg-[#ff6b35] text-white rounded-lg hover:bg-[#e55a2b] transition-colors font-semibold"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gradient-to-br from-white via-orange-50/35 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Text Content */}
            <div className="z-10">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
                <span className="text-gray-900">Practice. </span>
                <span className="text-[#ff6b35]">Understand.</span>
                <span className="text-gray-900"> Improve. </span>
                <span className="text-[#ff6b35]">Repeat.</span>
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl">
                High-quality exam-level tests with step-by-step solutions that help you learn from every mistake.
              </p>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button
                  onClick={() => router.push("/register")}
                  className="px-8 py-4 bg-[#ff6b35] text-white rounded-lg hover:bg-[#e55a2b] transition-all font-semibold text-lg flex items-center justify-center gap-2 group shadow-lg"
                >
                  Start Practicing
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-8 py-4 bg-transparent border-2 border-[#ff6b35] text-[#ff6b35] rounded-lg hover:bg-[#ff6b35] hover:text-white transition-all font-semibold text-lg"
                >
                  View Demo Report
                </button>
              </div>
            </div>

            {/* Right Side - Illustration */}
            <div className="relative lg:h-[600px] flex items-center justify-center">
              {/* Main Character Illustration */}
              <div className="relative w-full max-w-lg">
                {/* Student Character */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20">
                  {/* Head */}
                  <div className="w-24 h-24 bg-gradient-to-br from-amber-200 to-amber-300 rounded-full border-4 border-white shadow-2xl mx-auto mb-2"></div>
                  {/* Body */}
                  <div className="w-32 h-40 bg-gradient-to-br from-[#ff6b35] to-orange-600 rounded-2xl shadow-2xl mx-auto relative">
                    {/* Book in hand */}
                    <div className="absolute -left-6 top-8 w-12 h-16 bg-white rounded-lg shadow-xl transform -rotate-12">
                      <div className="p-2">
                        <div className="h-1 bg-orange-200 rounded mb-1"></div>
                        <div className="h-1 bg-orange-200 rounded mb-1"></div>
                        <div className="h-1 bg-orange-200 rounded"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Large Tablet/Device */}
                <div className="absolute top-10 right-0 w-64 h-80 bg-gradient-to-br from-[#ff6b35] to-yellow-500 rounded-3xl shadow-2xl p-4 z-10">
                  {/* Device Screen */}
                  <div className="bg-white rounded-2xl h-full p-4 relative overflow-hidden">
                    {/* Top notch */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-2 bg-gray-800 rounded-full"></div>
                    
                    {/* Screen Content */}
                    <div className="mt-6 space-y-3">
                      {/* Progress bar */}
                      <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#ff6b35] to-yellow-500 rounded-full w-3/4"></div>
                      </div>
                      
                      {/* Wavy lines */}
                      <div className="space-y-2">
                        <div className="h-1 bg-gradient-to-r from-orange-200 to-yellow-200 rounded-full"></div>
                        <div className="h-1 bg-gradient-to-r from-yellow-200 to-amber-200 rounded-full w-5/6"></div>
                        <div className="h-1 bg-gradient-to-r from-amber-200 to-orange-200 rounded-full w-4/6"></div>
                      </div>
                      
                      {/* Stars */}
                      <div className="flex gap-1 mt-4">
                        {[...Array(2)].map((_, i) => (
                          <svg key={i} className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      
                      {/* Checklist extending from bottom */}
                      <div className="absolute bottom-4 right-0 bg-[#ff6b35] text-white px-4 py-2 rounded-l-lg shadow-lg">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="font-bold text-sm">TEST</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decorative Elements */}
                {/* Gear Icon */}
                <div className="absolute top-32 right-20 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-xl z-30">
                  <svg className="w-10 h-10 text-gray-900" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                </div>

                {/* Plant */}
                <div className="absolute bottom-20 left-10 w-12 h-16 bg-green-400 rounded-t-full shadow-xl z-20">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-green-300 rounded-full"></div>
                  <div className="absolute -top-2 left-2 w-6 h-6 bg-green-200 rounded-full"></div>
                  <div className="absolute -top-2 right-2 w-6 h-6 bg-green-200 rounded-full"></div>
                </div>

                {/* Small Console */}
                <div className="absolute bottom-32 right-32 w-20 h-12 bg-gray-800 rounded-lg shadow-xl z-20 flex items-center justify-center gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Our Test Series Section */}
      <section id="features" className="py-20 bg-gradient-to-br from-gray-50 via-orange-50/35 to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why Choose Our Test Series?</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              We don't just give tests — we help students understand their performance and fix mistakes the right way.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Poster/Icon */}
            <div className="flex items-center justify-center">
              <div className="relative w-full max-w-md">
                <div className="bg-gradient-to-br from-[#ff6b35] to-yellow-400 rounded-3xl p-12 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
                  <div className="bg-white rounded-2xl p-8 shadow-lg">
                    <div className="text-center">
                      <div className="w-32 h-32 bg-gradient-to-br from-[#ff6b35] to-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
                        <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">Test Series</h3>
                      <p className="text-gray-600">Your Path to Success</p>
                    </div>
                  </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-300 rounded-full opacity-20 blur-xl"></div>
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-orange-300 rounded-full opacity-20 blur-xl"></div>
              </div>
            </div>

            {/* Right Side - 4 Headings with Hover Content */}
            <div className="space-y-4">
              {/* Feature 1: Detailed Performance Reports */}
              <div className="group relative">
                <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-[#ff6b35] transition-all duration-300 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#ff6b35] to-yellow-400 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">📊</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#ff6b35] transition-colors">
                        Detailed Performance Reports
                      </h3>
                    </div>
                    <svg className="w-6 h-6 text-gray-400 group-hover:text-[#ff6b35] transform group-hover:rotate-90 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  
                  {/* Content on Hover */}
                  <div className="max-h-0 overflow-hidden group-hover:max-h-[500px] transition-all duration-500 ease-in-out">
                    <div className="pt-4 mt-4 border-t border-gray-200">
                      <ul className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Combined Reports to track overall progress</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Test-wise Analysis for every single test</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Topic-wise strengths & weaknesses</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Accuracy, speed, and rank insights</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Compare performance with peers</span>
                        </li>
                      </ul>
                      <p className="mt-4 text-[#ff6b35] font-semibold">
                        Know exactly where you stand and what to improve.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 2: Tests Based on Real Exam Pattern */}
              <div className="group relative">
                <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-[#ff6b35] transition-all duration-300 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#ff6b35] to-yellow-400 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">📝</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#ff6b35] transition-colors">
                        Tests Based on Real Exam Pattern
                      </h3>
                    </div>
                    <svg className="w-6 h-6 text-gray-400 group-hover:text-[#ff6b35] transform group-hover:rotate-90 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  
                  {/* Content on Hover */}
                  <div className="max-h-0 overflow-hidden group-hover:max-h-[500px] transition-all duration-500 ease-in-out">
                    <div className="pt-4 mt-4 border-t border-gray-200">
                      <ul className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Tests strictly follow the latest exam syllabus & pattern</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Balanced mix of easy, moderate & high-level questions</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Proper time distribution like the actual exam</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Sectional tests, full-length tests & practice tests</span>
                        </li>
                      </ul>
                      <p className="mt-4 text-[#ff6b35] font-semibold">
                        No surprises on exam day.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 3: High-Quality Questions */}
              <div className="group relative">
                <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-[#ff6b35] transition-all duration-300 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#ff6b35] to-yellow-400 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🧠</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#ff6b35] transition-colors">
                        High-Quality Questions
                      </h3>
                    </div>
                    <svg className="w-6 h-6 text-gray-400 group-hover:text-[#ff6b35] transform group-hover:rotate-90 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  
                  {/* Content on Hover */}
                  <div className="max-h-0 overflow-hidden group-hover:max-h-[500px] transition-all duration-500 ease-in-out">
                    <div className="pt-4 mt-4 border-t border-gray-200">
                      <ul className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Carefully curated questions by experienced educators</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Focus on concept clarity, not rote learning</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Covers all important & frequently asked topics</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Updated regularly as per exam trends</span>
                        </li>
                      </ul>
                      <p className="mt-4 text-[#ff6b35] font-semibold">
                        Practice questions that actually matter.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature 4: Detailed & Step-by-Step Solutions */}
              <div className="group relative">
                <div className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-[#ff6b35] transition-all duration-300 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#ff6b35] to-yellow-400 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">📘</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#ff6b35] transition-colors">
                        Detailed & Step-by-Step Solutions
                      </h3>
                    </div>
                    <svg className="w-6 h-6 text-gray-400 group-hover:text-[#ff6b35] transform group-hover:rotate-90 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  
                  {/* Content on Hover */}
                  <div className="max-h-0 overflow-hidden group-hover:max-h-[500px] transition-all duration-500 ease-in-out">
                    <div className="pt-4 mt-4 border-t border-gray-200">
                      <ul className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Clear, well-explained solutions for every question</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Multiple approaches wherever applicable</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Concept explanation + exam-oriented tips</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-[#ff6b35] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Helps students learn even from wrong answers</span>
                        </li>
                      </ul>
                      <p className="mt-4 text-[#ff6b35] font-semibold">
                        Mistakes become your biggest strength.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Test Series Section */}
      <section id="test-series" className="py-20 bg-gradient-to-br from-white via-orange-50/25 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Test Series</h2>
            <p className="text-lg text-gray-600">Choose from our comprehensive collection</p>
          </div>

          {loadingTestSeries ? (
            <div className="text-center py-16">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
              <p className="text-gray-600 font-medium">Loading test series...</p>
            </div>
          ) : testSeriesList.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-600 font-medium">No test series available at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testSeriesList.map((series) => {
                const isFree = !series.price || series.price === 0;
                const originalPrice = series.originalPrice || (series.price ? Math.round(series.price * 1.15) : 0);
                const discountPercent = series.discount || (series.price && series.price > 0 ? 15 : 0);
                
                return (
                  <div
                    key={series.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-lg hover:shadow-xl transition-all overflow-hidden"
                  >
                    {/* Thumbnail Section */}
                    {series.thumbnail ? (
                      <div className="relative w-full h-48 overflow-hidden bg-gray-100">
                        <img
                          src={series.thumbnail}
                          alt={series.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        {series.mode && (
                          <div className="absolute top-3 left-3">
                            <span className={`${
                              series.mode === "offline" 
                                ? "bg-red-500" 
                                : "bg-[#ff6b35]"
                            } text-white px-3 py-1 text-xs font-semibold rounded-lg uppercase`}>
                              {series.mode === "offline" ? "OFFLINE" : "ONLINE"}
                            </span>
                          </div>
                        )}
                        {!isFree && discountPercent > 0 && (
                          <div className="absolute top-3 right-3">
                            <span className="bg-orange-500 text-white px-3 py-1 text-sm font-bold rounded-lg">
                              {discountPercent}% OFF
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative w-full h-48 bg-gradient-to-br from-[#ff6b35] to-yellow-500 flex items-center justify-center">
                        {series.mode && (
                          <div className="absolute top-3 left-3">
                            <span className={`${
                              series.mode === "offline" 
                                ? "bg-red-500" 
                                : "bg-white text-blue-600"
                            } px-3 py-1 text-xs font-semibold rounded-lg uppercase`}>
                              {series.mode === "offline" ? "OFFLINE" : "ONLINE"}
                            </span>
                          </div>
                        )}
                        <div className="text-white text-5xl font-bold opacity-50">
                          {series.title.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}

                    {/* Content Section */}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-xl font-bold text-gray-900 flex-1">
                          {series.title}
                        </h3>
                        {isFree && (
                          <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded ml-2">
                            FREE
                          </span>
                        )}
                      </div>

                      <div className="mb-4">
                        {series.description ? (
                          <div 
                            className="text-gray-600 text-sm leading-relaxed overflow-hidden"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              maxHeight: '4.5rem',
                            }}
                          >
                            <DescriptionRenderer description={series.description} className="text-sm" />
                          </div>
                        ) : (
                          <p className="text-gray-600 text-sm">Comprehensive test series for exam preparation</p>
                        )}
                      </div>

                      {series.testIds && series.testIds.length > 0 && (
                        <div className="mb-4 text-sm text-gray-500">
                          {series.testIds.length} Test{series.testIds.length !== 1 ? 's' : ''} included
                        </div>
                      )}

                      {/* Price and Action Buttons */}
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="mb-4">
                          <div className="flex items-baseline gap-2">
                            {!isFree && originalPrice > 0 && originalPrice > (series.price || 0) && (
                              <span className="text-sm text-gray-400 line-through">
                                ₹{originalPrice.toLocaleString()}
                              </span>
                            )}
                            <span className="text-2xl font-bold text-gray-900">
                              ₹{isFree ? "0" : (series.price || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleKnowMore(series.title);
                            }}
                            className="flex-1 border-2 border-gray-300 text-gray-700 hover:border-[#ff6b35] hover:text-[#ff6b35] hover:bg-orange-50 py-2 rounded-lg font-semibold transition-all text-sm"
                          >
                            View Details
                          </button>
                          <button
                            onClick={() => router.push("/dashboard")}
                            className="flex-1 bg-[#ff6b35] hover:bg-yellow-400 hover:text-gray-900 text-white py-2 rounded-lg font-semibold transition-all text-sm"
                          >
                            {isFree ? "Get Started" : "Enroll Now"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-white via-orange-50/30 to-white border-t border-gray-200 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-2">
              <div className="w-8 h-8 bg-[#ff6b35] rounded-full flex items-center justify-center">
                <span className="text-white font-bold">A</span>
              </div>
              <span>cad</span><span className="text-[#ff6b35]">XL</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">© 2024 AcadXL. All rights reserved.</p>
            <div className="flex justify-center gap-6">
              <a href="#" className="text-gray-600 hover:text-[#ff6b35] transition-colors text-sm">Privacy Policy</a>
              <a href="#" className="text-gray-600 hover:text-[#ff6b35] transition-colors text-sm">Terms of Service</a>
              <a href="#" className="text-gray-600 hover:text-[#ff6b35] transition-colors text-sm">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
