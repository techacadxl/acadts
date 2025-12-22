"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { listPublishedTestSeries, listTestSeries } from "@/lib/db/testSeries";
import type { TestSeries } from "@/lib/types/testSeries";

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
  const [currentSlide, setCurrentSlide] = useState(0);
  const [testSeriesList, setTestSeriesList] = useState<TestSeries[]>([]);
  const [loadingTestSeries, setLoadingTestSeries] = useState(true);

  const slides = [
    {
      title: "The Intelligent Classroom Era Begins",
      subtitle: "AI-Powered Learning Platform",
      description: "Transform your learning experience with our advanced test system",
      videoUrl: "#",
      image: "🎓"
    },
    {
      title: "Master Your Exams",
      subtitle: "Comprehensive Test Series",
      description: "Practice with thousands of questions and track your progress",
      videoUrl: "#",
      image: "📚"
    },
    {
      title: "Learn at Your Pace",
      subtitle: "Personalized Learning Path",
      description: "Adaptive tests that adjust to your learning style",
      videoUrl: "#",
      image: "🚀"
    }
  ];

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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

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
        // Set empty array on error so UI shows empty state instead of loading forever
        setTestSeriesList([]);
      } finally {
        setLoadingTestSeries(false);
      }
    };
    loadTestSeries();
  }, []);

  const handleKnowMore = async (title: string) => {
    console.log("[HomePage] Know More clicked for:", title);
    console.log("[HomePage] Available test series count:", testSeriesList.length);
    
    let seriesToSearch = testSeriesList;
    
    // If test series list is empty, load it first
    if (testSeriesList.length === 0) {
      console.log("[HomePage] Test series list is empty, loading...");
      try {
        const series = await listTestSeries();
        setTestSeriesList(series);
        seriesToSearch = series;
        console.log("[HomePage] Loaded test series:", series.length);
        console.log("[HomePage] Series titles:", series.map(s => s.title));
      } catch (error) {
        console.error("[HomePage] Error loading test series:", error);
        alert("Unable to load test series. Please try again.");
        return;
      }
    }
    
    // Try to find matching test series by title (more flexible matching)
    const matchingSeries = seriesToSearch.find((series) => {
      const seriesTitle = series.title.toLowerCase().trim();
      const searchTitle = title.toLowerCase().trim();
      
      console.log("[HomePage] Comparing:", seriesTitle, "with", searchTitle);
      
      // Exact match
      if (seriesTitle === searchTitle) {
        console.log("[HomePage] Exact match found!");
        return true;
      }
      
      // Contains match
      if (seriesTitle.includes(searchTitle) || searchTitle.includes(seriesTitle)) {
        console.log("[HomePage] Contains match found!");
        return true;
      }
      
      // Word match (for partial matches like "JEE Ultimate" matching "JEE Ultimate Test Series")
      const seriesWords = seriesTitle.split(/\s+/);
      const searchWords = searchTitle.split(/\s+/);
      const matchingWords = searchWords.filter(word => 
        seriesWords.some(sw => sw.includes(word) || word.includes(sw))
      );
      
      const isMatch = matchingWords.length >= Math.min(2, searchWords.length);
      if (isMatch) {
        console.log("[HomePage] Word match found!");
      }
      return isMatch;
    });
    
    if (matchingSeries && matchingSeries.id) {
      console.log("[HomePage] Found matching series:", matchingSeries.title, "ID:", matchingSeries.id);
      // Navigate to details page
      router.push(`/test-series/${matchingSeries.id}`);
    } else {
      console.log("[HomePage] No matching series found in database, using dummy data for:", title);
      
      // Use dummy data as fallback
      const dummyData = DUMMY_TEST_SERIES[title];
      if (dummyData) {
        // Create a dummy ID based on title
        const dummyId = title.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
        console.log("[HomePage] Using dummy data, navigating to:", `/test-series/${dummyId}`);
        // Store dummy data in sessionStorage to pass to details page
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
        console.log("[HomePage] No dummy data available for:", title);
        alert(`Test series "${title}" not found. Redirecting to dashboard.`);
        router.push("/dashboard");
      }
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // Show loading state while checking auth
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1a0f0a] via-[#2d1810] to-[#ff6b35]">
        <p className="text-white text-lg">Loading...</p>
      </div>
    );
  }

  // If user is logged in, show redirect message (they'll be redirected by useEffect)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1a0f0a] via-[#2d1810] to-[#ff6b35]">
        <p className="text-white text-lg">Redirecting to your dashboard...</p>
      </div>
    );
  }

  // Show landing page for non-logged-in users
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a0f0a] via-[#2d1810] to-[#ff6b35]">
      {/* Navbar */}
      <nav className="bg-[#ff6b35] text-white px-4 md:px-8 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="text-2xl font-bold">
              <div className="leading-tight">
                <div>AcadXL</div>
               
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <a href="#tests" className="hover:text-yellow-200 transition-colors">Tests</a>
              <a href="#series" className="hover:text-yellow-200 transition-colors">Test Series</a>
              <a href="#dashboard" className="hover:text-yellow-200 transition-colors">Dashboard</a>
              <div className="relative group">
                <a href="#resources" className="hover:text-yellow-200 transition-colors flex items-center">
                  Resources
                  <span className="ml-1">▼</span>
                </a>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push("/login")}
              className="px-4 py-2 bg-white text-[#ff6b35] rounded hover:bg-yellow-50 transition-colors font-medium"
            >
              Login
            </button>
            <button
              onClick={() => router.push("/register")}
              className="px-4 py-2 text-white hover:text-yellow-200 transition-colors font-medium"
            >
              Signup
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section with Slider */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left Side - AI/Graphic Section */}
            <div className="relative h-[400px] md:h-[500px] flex items-center justify-center">
              <div className="relative w-full h-full">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20">
                  <div className="grid grid-cols-8 gap-2 h-full">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div key={i} className="bg-yellow-400 rounded-sm opacity-30"></div>
                    ))}
                  </div>
                </div>
                
                {/* Central Graphic */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Glowing AI Circle */}
                    <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-[#ff6b35] to-yellow-400 flex items-center justify-center shadow-2xl animate-pulse">
                      <div className="text-6xl md:text-8xl font-bold text-white">AI</div>
                    </div>
                    
                    {/* Floating Icons */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-blue-400 rounded-xl flex items-center justify-center shadow-lg animate-bounce">
                      <span className="text-2xl">⚡</span>
                    </div>
                    <div className="absolute top-1/4 -left-8 w-16 h-16 bg-purple-400 rounded-xl flex items-center justify-center shadow-lg animate-bounce" style={{ animationDelay: '0.2s' }}>
                      <span className="text-2xl font-bold text-white">A</span>
                    </div>
                    <div className="absolute -bottom-8 left-1/4 w-16 h-16 bg-green-400 rounded-xl flex items-center justify-center shadow-lg animate-bounce" style={{ animationDelay: '0.4s' }}>
                      <span className="text-2xl">📄</span>
                    </div>
                    <div className="absolute bottom-1/4 -right-8 w-16 h-16 bg-pink-400 rounded-xl flex items-center justify-center shadow-lg animate-bounce" style={{ animationDelay: '0.6s' }}>
                      <span className="text-2xl">🏠</span>
                    </div>
                    <div className="absolute -top-8 right-1/4 w-16 h-16 bg-yellow-300 rounded-xl flex items-center justify-center shadow-lg animate-bounce" style={{ animationDelay: '0.8s' }}>
                      <span className="text-2xl">⭐</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Content Slider */}
            <div className="relative">
              <div className="relative h-[400px] md:h-[500px]">
                {/* Slider Container */}
                <div className="relative h-full overflow-hidden rounded-lg">
                  {slides.map((slide, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-opacity duration-500 ${
                        index === currentSlide ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      <div className="h-full flex flex-col justify-center space-y-6 p-6">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                          {slide.title}
                          <span className="block mt-2">
                            <span className="relative inline-block">
                              {slide.title.includes("Classroom") ? "Classroom" : slide.title.split(" ")[0]}
                              <svg className="absolute -bottom-2 left-0 w-full h-3 text-yellow-400" viewBox="0 0 200 20">
                                <path d="M0,15 Q50,5 100,10 T200,8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
                              </svg>
                            </span>
                          </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-yellow-300 font-semibold">
                          {slide.subtitle}
                        </p>
                        <p className="text-lg text-gray-200">
                          {slide.description}
                        </p>
                        
                        {/* Video Embed Section */}
                        <div className="border-2 border-yellow-400 rounded-lg p-4 bg-black/30 backdrop-blur-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white text-sm font-medium">
                              {slide.title} | AI that transforms learning
                            </span>
                            <div className="flex space-x-2">
                              <button className="text-yellow-400 hover:text-yellow-300">⏰</button>
                              <button className="text-yellow-400 hover:text-yellow-300">↗</button>
                            </div>
                          </div>
                          <div className="relative bg-gradient-to-br from-[#ff6b35] to-yellow-400 rounded aspect-video flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
                            <div className="text-6xl text-white">▶</div>
                            <div className="absolute bottom-2 left-2 flex items-center space-x-2 text-white text-xs">
                              <span>Watch on</span>
                              <span className="font-bold">YouTube</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Slider Navigation Arrows */}
                <button
                  onClick={prevSlide}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-[#ff6b35] text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-yellow-400 transition-colors shadow-lg z-10"
                  aria-label="Previous slide"
                >
                  ‹
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-[#ff6b35] text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-yellow-400 transition-colors shadow-lg z-10"
                  aria-label="Next slide"
                >
                  ›
                </button>

                {/* Slider Dots */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        index === currentSlide
                          ? 'bg-yellow-400 w-8'
                          : 'bg-white/50 hover:bg-white/75'
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Series Section */}
      <section id="series" className="py-16 md:py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Our Test Series
            </h2>
            <p className="text-xl text-yellow-300">
              Choose from our comprehensive collection of test series
            </p>
          </div>

          {loadingTestSeries ? (
            <div className="text-center py-12">
              <p className="text-white text-lg">Loading test series...</p>
            </div>
          ) : testSeriesList.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white text-lg">No test series available at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testSeriesList.map((series) => {
                const isFree = !series.price || series.price === 0;
                const originalPrice = series.price ? Math.round(series.price * 1.15) : 0;
                const discountPercent = series.price && series.price > 0 ? 15 : 0;
                
                // Strip HTML tags from description for preview
                const stripHtml = (html: string) => {
                  if (typeof window === 'undefined') {
                    // Server-side: simple regex approach
                    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
                  }
                  // Client-side: use DOM
                  const tmp = document.createElement("DIV");
                  tmp.innerHTML = html;
                  return tmp.textContent || tmp.innerText || "";
                };
                
                const cleanDescription = series.description ? stripHtml(series.description).trim() : '';
                const descriptionPreview = cleanDescription 
                  ? (cleanDescription.length > 120 ? cleanDescription.substring(0, 120) + '...' : cleanDescription)
                  : "Comprehensive test series for exam preparation";
                
                return (
                  <div
                    key={series.id}
                    className="bg-white rounded-lg shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:scale-105"
                  >
                    {series.thumbnail ? (
                      <div className="w-full h-48 overflow-hidden bg-gray-100">
                        <img
                          src={series.thumbnail}
                          alt={series.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error("[HomePage] Thumbnail load error for:", series.title);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <span className="bg-black text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                          <span>📹</span> {isFree ? "FREE" : "PREMIUM"}
                        </span>
                        {!isFree && (
                          <span className="bg-[#ff6b35] text-white text-xs font-semibold px-3 py-1 rounded-full">
                            {discountPercent > 0 ? `${discountPercent}% EARLY BIRD DISCOUNT` : "PREMIUM"}
                          </span>
                        )}
                        {isFree && (
                          <span className="bg-[#ff6b35] text-white text-xs font-semibold px-3 py-1 rounded-full">
                            FREE ACCESS
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {series.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {descriptionPreview}
                      </p>
                      
                      {series.testIds && series.testIds.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500">
                            {series.testIds.length} Test{series.testIds.length !== 1 ? 's' : ''} included
                          </p>
                        </div>
                      )}

                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            {!isFree && originalPrice > 0 && (
                              <span className="text-sm text-gray-500 line-through">
                                ₹{originalPrice.toLocaleString()}
                              </span>
                            )}
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold text-gray-900">
                                ₹{isFree ? "0" : (series.price || 0).toLocaleString()}
                              </span>
                              <span className="text-sm text-gray-500">+ Taxes</span>
                            </div>
                          </div>
                          {!isFree && discountPercent > 0 && (
                            <span className="bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">
                              {discountPercent}% OFF
                            </span>
                          )}
                          {isFree && (
                            <span className="bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded">
                              FREE
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => router.push("/dashboard")}
                          className="w-full bg-[#ff6b35] hover:bg-yellow-400 text-white py-2 rounded-lg font-semibold transition-all mb-2"
                        >
                          {isFree ? "Get Started Free" : "Buy Now"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleKnowMore(series.title);
                          }}
                          className="w-full text-center text-blue-600 hover:text-blue-800 text-sm font-medium py-1 cursor-pointer"
                        >
                          Know More →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Call to Action Button */}
      <div className="fixed bottom-8 right-8 z-20">
        <button
          onClick={() => router.push("/dashboard")}
          className="bg-[#ff6b35] text-white px-6 py-3 rounded-lg shadow-2xl hover:bg-yellow-400 transition-all transform hover:scale-105 font-semibold text-lg"
        >
          Explore Our Test Suite
        </button>
      </div>

    </div>
  );
}
