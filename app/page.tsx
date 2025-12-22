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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-700 text-lg">Loading...</p>
      </div>
    );
  }

  // If user is logged in, show redirect message (they'll be redirected by useEffect)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-700 text-lg">Redirecting to your dashboard...</p>
      </div>
    );
  }

  // Show landing page for non-logged-in users
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background Texture Pattern */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full">
          {/* Golden/Yellow Geometric Pattern */}
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="texture" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <rect width="40" height="40" fill="white"/>
                <circle cx="10" cy="10" r="2" fill="#fcd34d" opacity="0.2"/>
                <circle cx="30" cy="10" r="2" fill="#fcd34d" opacity="0.2"/>
                <circle cx="10" cy="30" r="2" fill="#fcd34d" opacity="0.2"/>
                <circle cx="30" cy="30" r="2" fill="#fcd34d" opacity="0.2"/>
                <polygon points="20,5 25,15 15,15" fill="#fcd34d" opacity="0.15"/>
                <polygon points="20,35 25,25 15,25" fill="#fcd34d" opacity="0.15"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#texture)"/>
          </svg>
        </div>
      </div>
      
      {/* Top Dark Teal Bar */}
      <div className="h-1 bg-teal-800"></div>
      
      {/* Navbar - Orange Background */}
      <nav className="bg-[#ff6b35] text-white px-4 md:px-8 py-4 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-8">
            {/* Logo */}
            <div className="text-2xl font-bold text-white">
              <div className="leading-tight">
                <div className="flex items-center">
                  <span className="text-white">Acad</span>
                  <span className="text-white relative">
                    XL
                    <span className="absolute -top-1 left-0 text-yellow-300 text-sm">▲</span>
                  </span>
                </div>
              </div>
            </div>
            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-6">
              <a href="#tests" className="text-white hover:text-yellow-200 transition-colors font-medium">Tests</a>
              <a href="#series" className="text-white hover:text-yellow-200 transition-colors font-medium">Test Series</a>
              <a href="#dashboard" className="text-white hover:text-yellow-200 transition-colors font-medium">Dashboard</a>
              <div className="relative group">
                <a href="#resources" className="text-white hover:text-yellow-200 transition-colors flex items-center font-medium">
                  Resources
                  <span className="ml-1 text-sm">▼</span>
                </a>
              </div>
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push("/login")}
              className="px-4 py-2 border-2 border-white text-white rounded hover:bg-white/10 transition-colors font-medium"
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
      <div className="relative overflow-hidden bg-white relative z-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Left Side - AI/Graphic Section */}
            <div className="relative h-[400px] md:h-[500px] flex items-center justify-center">
              <div className="relative w-full h-full">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="grid grid-cols-8 gap-2 h-full">
                    {Array.from({ length: 64 }).map((_, i) => (
                      <div key={i} className="bg-[#fcd34d] rounded-sm opacity-20"></div>
                    ))}
                  </div>
                </div>
                
                {/* Central Graphic */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Glowing AI Circle */}
                    <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#fcd34d] flex items-center justify-center shadow-2xl">
                      <div className="text-6xl md:text-8xl font-bold text-gray-100">AI</div>
                    </div>
                    
                    {/* Floating Icons */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-[#a78bfa] rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-2xl font-bold text-white">A</span>
                    </div>
                    <div className="absolute top-1/4 -left-8 w-16 h-16 bg-[#60a5fa] rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-2xl">⭐</span>
                    </div>
                    <div className="absolute -bottom-8 left-1/4 w-16 h-16 bg-[#34d399] rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-2xl">📄</span>
                    </div>
                    <div className="absolute bottom-1/4 -right-8 w-16 h-16 bg-[#f472b6] rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-2xl">🏠</span>
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
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                          Begins
                          <span className="block mt-2">
                            <span className="relative inline-block">
                              Classroom
                              <svg className="absolute -bottom-2 left-0 w-full h-3 text-[#fcd34d]" viewBox="0 0 200 20">
                                <path d="M0,15 Q50,5 100,10 T200,8" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
                              </svg>
                            </span>
                          </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-[#fcd34d] font-semibold">
                          AI-Powered Learning Platform
                        </p>
                        <p className="text-lg text-gray-700">
                          Transform your learning experience with our advanced test system
                        </p>
                        
                        {/* Video Embed Section */}
                        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-md">
                          <div className="bg-gray-900 px-4 py-2 flex items-center justify-between">
                            <span className="text-white text-sm font-medium">
                              The Intelligent Classroom Era Begins | AI that transforms learning
                            </span>
                            <div className="flex space-x-2">
                              <button className="text-red-500 hover:text-red-400">⏰</button>
                              <button className="text-[#fcd34d] hover:text-yellow-400">↗</button>
                            </div>
                          </div>
                          <div className="relative bg-gradient-to-br from-[#ff6b35] to-[#fcd34d] aspect-video flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
                            <div className="w-16 h-16 bg-blue-400 rounded-lg flex items-center justify-center">
                              <div className="text-3xl text-white ml-1">▶</div>
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
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-[#ff6b35] text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-[#ff8555] transition-colors shadow-lg z-10"
                  aria-label="Previous slide"
                >
                  ‹
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-[#ff6b35] text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-[#ff8555] transition-colors shadow-lg z-10"
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
                          ? 'bg-[#fcd34d] w-8'
                          : 'bg-gray-400 hover:bg-gray-500'
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
      <section id="series" className="py-16 md:py-24 px-4 md:px-8 bg-white relative z-0">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Our Test Series
            </h2>
            <p className="text-xl text-[#fcd34d] font-medium">
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
                const originalPrice = series.originalPrice || (series.price ? Math.round(series.price * 1.15) : 0);
                const discountPercent = series.discount || (series.price && series.price > 0 ? 15 : 0);
                
                // Format dates
                const formatDate = (timestamp: any) => {
                  if (!timestamp) return null;
                  try {
                    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  } catch {
                    return null;
                  }
                };
                const startDateStr = series.startDate ? formatDate(series.startDate) : null;
                const endDateStr = series.endDate ? formatDate(series.endDate) : null;
                
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
                    className="bg-white rounded-lg shadow-xl overflow-hidden border border-red-600 relative"
                  >
                    {/* Thumbnail/Banner Section */}
                    {series.thumbnail ? (
                      <div className="relative w-full h-56 overflow-hidden">
                        {/* Background Image - Only Image, No Overlay */}
                        <img
                          src={series.thumbnail}
                          alt={series.title}
                          className="w-full h-full object-cover"
                          style={{ objectPosition: 'center' }}
                          onError={(e) => {
                            console.error("[HomePage] Thumbnail load error for:", series.title);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        
                        {/* OFFLINE/ONLINE Tag - Top Left Corner */}
                        <div className="absolute top-3 left-3 z-10">
                          <div className={`${
                            series.mode === "offline" 
                              ? "bg-red-600" 
                              : "bg-blue-500"
                          } text-white px-3 py-1 font-bold text-xs uppercase shadow-lg`}
                          style={{
                            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)'
                          }}>
                            {series.mode === "offline" ? "OFFLINE" : "ONLINE"}
                          </div>
                        </div>
                        
                        {/* Discount Badge - Top Right Corner */}
                        {!isFree && discountPercent > 0 && (
                          <div className="absolute top-3 right-3 z-20" style={{ zIndex: 20 }}>
                            <div className="bg-gray-900 rounded-lg px-4 py-3 shadow-2xl">
                              <div className="text-white text-xs font-semibold mb-1 uppercase tracking-wide">GET UP TO</div>
                              <div className="text-white font-bold text-3xl leading-none">
                                {discountPercent}% <span className="text-xl">OFF</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative w-full h-56 bg-gradient-to-r from-orange-800 via-orange-700 to-orange-600 flex items-center justify-center">
                        {/* OFFLINE/ONLINE Tag - Top Left Corner */}
                        <div className="absolute top-3 left-3 z-10">
                          <div className={`${
                            series.mode === "offline" 
                              ? "bg-red-600" 
                              : "bg-blue-500"
                          } text-white px-3 py-1 font-bold text-xs uppercase shadow-lg`}
                          style={{
                            clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)'
                          }}>
                            {series.mode === "offline" ? "OFFLINE" : "ONLINE"}
                          </div>
                        </div>
                        <div className="text-white text-6xl font-bold opacity-50">
                          {series.title.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}

                    {/* Content Section */}
                    <div className="p-6">
                      {/* Title and Badges Row */}
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-xl font-bold text-gray-900 flex-1 mr-2">
                          {series.title}
                        </h3>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isFree && (
                            <span className="bg-yellow-400 text-black text-xs font-semibold px-2 py-1 rounded">
                              NEW
                            </span>
                          )}
                          <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-1 rounded">
                            Hinglish
                          </span>
                        </div>
                      </div>

                      {/* WhatsApp and Contact Icons */}
                      <div className="flex items-center gap-2 mb-3">
                        {series.whatsappLink && (
                          <a
                            href={series.whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500 hover:bg-green-600 text-white transition-colors shadow-md"
                            onClick={(e) => e.stopPropagation()}
                            title="Join WhatsApp Group"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                          </a>
                        )}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-900 text-white transition-colors shadow-md cursor-pointer">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* Course Details */}
                      {series.targetClass && (
                        <div className="mb-2 flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span className="text-xs">For {series.targetClass}</span>
                        </div>
                      )}
                      
                      {(startDateStr || endDateStr) && (
                        <div className="mb-3 flex items-center gap-2 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs">
                            {startDateStr && endDateStr 
                              ? `Starts on ${startDateStr} Ends on ${endDateStr}`
                              : startDateStr 
                              ? `Starts on ${startDateStr}`
                              : `Ends on ${endDateStr}`
                            }
                          </span>
                        </div>
                      )}
                      
                      {series.testIds && series.testIds.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500">
                            {series.testIds.length} Test{series.testIds.length !== 1 ? 's' : ''} included
                          </p>
                        </div>
                      )}

                      {/* Price and Action Buttons */}
                      <div className="border-t pt-4 mt-4">
                        <div className="mb-4">
                          <div className="flex items-baseline gap-2 mb-1">
                            {!isFree && originalPrice > 0 && originalPrice > (series.price || 0) && (
                              <span className="text-sm text-gray-500 line-through">
                                ₹{originalPrice.toLocaleString()}
                              </span>
                            )}
                            <span className="text-2xl font-bold text-purple-600">
                              ₹{isFree ? "0" : (series.price || 0).toLocaleString()}
                            </span>
                          </div>
                          {!isFree && (
                            <p className="text-xs text-gray-500">(FOR FULL BATCH)</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleKnowMore(series.title);
                            }}
                            className="flex-1 border-2 border-purple-600 text-purple-600 hover:bg-purple-50 py-2 rounded-lg font-semibold transition-all text-sm"
                          >
                            EXPLORE
                          </button>
                          <button
                            onClick={() => router.push("/dashboard")}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-semibold transition-all text-sm"
                          >
                            {isFree ? "GET STARTED" : "BUY NOW"}
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

      {/* Call to Action Button */}
      <div className="fixed bottom-8 right-8 z-20">
        <button
          onClick={() => router.push("/dashboard")}
          className="bg-[#ff6b35] text-white px-6 py-3 rounded-lg shadow-2xl hover:bg-[#ff8555] transition-all transform hover:scale-105 font-semibold text-lg"
        >
          Explore Our Test Suite
        </button>
      </div>
      
      {/* Footer Logo */}
      <div className="fixed bottom-8 left-8 z-20">
        <div className="w-12 h-12 bg-black flex items-center justify-center rounded">
          <span className="text-white text-xl font-bold">N</span>
        </div>
      </div>

    </div>
  );
}

