// app/admin/test-series/[id]/edit/page.tsx
"use client";

import { FormEvent, useCallback, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getTestSeriesById, updateTestSeries } from "@/lib/db/testSeries";
import { listTests } from "@/lib/db/tests";
import type { Test } from "@/lib/types/test";
import type { TestSeriesInput } from "@/lib/types/testSeries";
import RichTextEditor from "@/components/RichTextEditor";
import { uploadImage } from "@/lib/utils/imageStorage";
import { Timestamp } from "firebase/firestore";
import { sanitizeInput } from "@/lib/utils/validation";

export default function EditTestSeriesPage() {
  const router = useRouter();
  const params = useParams();
  const testSeriesId = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>("");
  const [originalPrice, setOriginalPrice] = useState<string>("");
  const [discount, setDiscount] = useState<string>("");
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [targetClass, setTargetClass] = useState<string>("");
  const [whatsappLink, setWhatsappLink] = useState<string>("");
  const [telegramLink, setTelegramLink] = useState<string>("");
  const [thumbnail, setThumbnail] = useState<string>("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [loadingTests, setLoadingTests] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load test series data
  useEffect(() => {
    const loadTestSeries = async () => {
      if (!testSeriesId) return;

      try {
        setLoadingSeries(true);
        const seriesData = await getTestSeriesById(testSeriesId);
        if (!seriesData) {
          setError("Test series not found.");
          setLoadingSeries(false);
          return;
        }

        setTitle(seriesData.title);
        setDescription(seriesData.description || "");
        setPrice(seriesData.price?.toString() || "0");
        setOriginalPrice(seriesData.originalPrice?.toString() || "");
        setDiscount(seriesData.discount?.toString() || "");
        setMode(seriesData.mode || "online");
        setTargetClass(seriesData.targetClass || "");
        setWhatsappLink(seriesData.whatsappLink || "");
        setTelegramLink(seriesData.telegramLink || "");
        setThumbnail(seriesData.thumbnail || "");
        setIsPublished(seriesData.isPublished ?? false);
        setSelectedTestIds(new Set(seriesData.testIds));
        
        // Convert Timestamps to date strings
        if (seriesData.startDate) {
          const startDateObj = seriesData.startDate.toDate();
          setStartDate(startDateObj.toISOString().split('T')[0]);
        }
        if (seriesData.endDate) {
          const endDateObj = seriesData.endDate.toDate();
          setEndDate(endDateObj.toISOString().split('T')[0]);
        }
        
        setLoadingSeries(false);
      } catch (err) {
        console.error("[EditTestSeriesPage] Error loading test series:", err);
        setError("Failed to load test series. Please try again.");
        setLoadingSeries(false);
      }
    };

    if (user && role === "admin") {
      loadTestSeries();
    }
  }, [user, role, testSeriesId]);

  // Load all tests
  useEffect(() => {
    const loadTests = async () => {
      try {
        setLoadingTests(true);
        const data = await listTests();
        setTests(data);
      } catch (err) {
        console.error("[EditTestSeriesPage] Error loading tests:", err);
        setError("Failed to load tests. Please try again.");
      } finally {
        setLoadingTests(false);
      }
    };

    if (user && role === "admin") {
      loadTests();
    }
  }, [user, role]);

  // Handle test selection
  const handleTestToggle = useCallback((testId: string) => {
    setSelectedTestIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(testId)) {
        newSet.delete(testId);
      } else {
        newSet.add(testId);
      }
      return newSet;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      console.log("[EditTestSeriesPage] Form submitted, attempting to update test series");

      if (!user) {
        setError("You must be logged in to update test series.");
        return;
      }

      // Basic validation
      const sanitizedTitle = sanitizeInput(title).trim();
      // Don't sanitize description - it contains HTML from RichTextEditor
      const descriptionValue = description.trim();
      const priceValue = parseFloat(price);

      if (!sanitizedTitle) {
        setError("Test series title is required.");
        return;
      }

      if (selectedTestIds.size === 0) {
        setError("Please select at least one test for the series.");
        return;
      }

      if (isNaN(priceValue) || priceValue < 0) {
        setError("Please enter a valid price (must be a positive number).");
        return;
      }

      setSubmitting(true);
      setError(null);

      try {
        // Upload thumbnail if a new file is selected
        let thumbnailUrl = thumbnail;
        if (thumbnailFile) {
          setUploadingThumbnail(true);
          try {
            const uploadResult = await uploadImage(thumbnailFile, {
              provider: 'base64',
              folder: 'test-series-thumbnails'
            });
            thumbnailUrl = uploadResult.url;
            console.log("[EditTestSeriesPage] Thumbnail uploaded:", thumbnailUrl);
          } catch (uploadErr) {
            console.error("[EditTestSeriesPage] Thumbnail upload error:", uploadErr);
            throw new Error(
              uploadErr instanceof Error
                ? uploadErr.message
                : "Failed to upload thumbnail. Please try again."
            );
          } finally {
            setUploadingThumbnail(false);
          }
        }

        // Calculate discount if original price is provided
        let discountPercent: number | undefined;
        let finalOriginalPrice: number | undefined;
        if (originalPrice && originalPrice.trim()) {
          const originalPriceValue = parseFloat(originalPrice);
          if (!isNaN(originalPriceValue) && originalPriceValue > priceValue) {
            finalOriginalPrice = originalPriceValue;
            discountPercent = Math.round(((originalPriceValue - priceValue) / originalPriceValue) * 100);
          }
        } else if (discount && discount.trim()) {
          discountPercent = parseFloat(discount);
          if (!isNaN(discountPercent) && discountPercent > 0 && discountPercent <= 100) {
            finalOriginalPrice = Math.round(priceValue / (1 - discountPercent / 100));
          }
        }

        // Convert dates to Timestamps
        let startDateTimestamp: Timestamp | undefined;
        let endDateTimestamp: Timestamp | undefined;
        if (startDate) {
          startDateTimestamp = Timestamp.fromDate(new Date(startDate));
        }
        if (endDate) {
          endDateTimestamp = Timestamp.fromDate(new Date(endDate));
        }

        const updates: Partial<TestSeriesInput> = {
          title: sanitizedTitle,
          description: descriptionValue,
          testIds: Array.from(selectedTestIds),
          price: priceValue,
          isPublished: isPublished,
          thumbnail: thumbnailUrl || undefined,
          mode: mode,
          discount: discountPercent,
          originalPrice: finalOriginalPrice,
          startDate: startDateTimestamp,
          endDate: endDateTimestamp,
          targetClass: targetClass.trim() || undefined,
          whatsappLink: whatsappLink.trim() || undefined,
          telegramLink: telegramLink.trim() || undefined,
        };

        console.log("[EditTestSeriesPage] Final updates:", updates);

        await updateTestSeries(testSeriesId, updates);
        console.log("[EditTestSeriesPage] Test series updated");

        router.push(`/admin/test-series/${testSeriesId}`);
      } catch (err) {
        console.error("[EditTestSeriesPage] Error updating test series:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to update test series. Please try again.";
        setError(errorMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [user, testSeriesId, title, description, price, selectedTestIds, router]
  );

  const handleCancel = useCallback(() => {
    router.push(`/admin/test-series/${testSeriesId}`);
  }, [router, testSeriesId]);

  if (authLoading || profileLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="p-4 text-gray-600">Checking admin access...</p>
      </main>
    );
  }

  if (!user || role !== "admin") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="p-4 text-gray-600">Redirecting...</p>
      </main>
    );
  }

  if (loadingSeries || loadingTests) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="p-4 text-gray-600">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">
              Edit Test Series
            </h1>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-600 hover:text-gray-800 underline focus:outline-none"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Basic Test Series Information */}
            <div className="border-b border-gray-200 pb-4">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Test Series Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Series Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. JEE Main Test Series 2024"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Thumbnail Image
                  </label>
                  <div className="space-y-2">
                    {thumbnail && (
                      <div className="relative w-full h-48 border border-gray-300 rounded overflow-hidden bg-gray-50">
                        <img
                          src={thumbnail}
                          alt="Thumbnail preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setThumbnail("");
                            setThumbnailFile(null);
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          aria-label="Remove thumbnail"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setThumbnailFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setThumbnail(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <p className="text-xs text-gray-500">
                      Recommended: 800x450px or 16:9 aspect ratio. Max size: 500KB
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <RichTextEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Enter test series description... You can drag and drop images directly into the editor."
                    minHeight="400px"
                    imageFolder="test-series"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    Use the rich text editor to format your description. You can add headings, lists, images, links, and more.
                  </p>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full border border-gray-300 rounded px-3 py-2 pl-7 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Enter the price for this test series</p>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Original Price (Before Discount)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full border border-gray-300 rounded px-3 py-2 pl-7 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Leave empty if no discount</p>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-gray-500">Enter discount percentage (0-100)</p>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Course Mode
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as "online" | "offline")}
                  >
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      Start Date
                    </label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-sm font-medium text-gray-700">
                      End Date
                    </label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Target Class/Grade
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    placeholder="e.g. 11th, 12th, Dropper, Foundation"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    WhatsApp Group Link
                  </label>
                  <input
                    type="url"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    value={whatsappLink}
                    onChange={(e) => setWhatsappLink(e.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                  />
                </div>

                <div>
                  <label className="block mb-1 text-sm font-medium text-gray-700">
                    Telegram Group Link
                  </label>
                  <input
                    type="url"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    value={telegramLink}
                    onChange={(e) => setTelegramLink(e.target.value)}
                    placeholder="https://t.me/..."
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Publish this test series
                    </span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500 ml-6">
                    Published test series will be visible to students on the home page
                  </p>
                </div>
              </div>
            </div>

            {/* Test Selection */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Select Tests ({selectedTestIds.size} selected)
              </h2>

              {tests.length === 0 ? (
                <div className="text-center py-8 text-gray-600 border border-dashed border-gray-300 rounded">
                  No tests available. Please create tests first.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-700 w-12">
                          Select
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Title
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Description
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Duration
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-700">
                          Questions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tests.map((test) => {
                        const isSelected = selectedTestIds.has(test.id);
                        return (
                          <tr
                            key={test.id}
                            className={`border-b last:border-b-0 ${
                              isSelected ? "bg-blue-50" : ""
                            }`}
                          >
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={isSelected}
                                onChange={() => handleTestToggle(test.id)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-gray-900 font-medium">
                                {test.title}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-gray-600 text-sm line-clamp-2">
                                {test.description || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-gray-700">
                              {test.durationMinutes} min
                            </td>
                            <td className="px-4 py-2 text-gray-700">
                              {test.questions.length}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || uploadingThumbnail}
                className="px-4 py-2 text-sm bg-black hover:bg-gray-900 text-white rounded disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
              >
                {submitting || uploadingThumbnail ? "Updating..." : "Update Test Series"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}



