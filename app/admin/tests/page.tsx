// app/admin/tests/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { listTests, deleteTest } from "@/lib/db/tests";
import { cache } from "@/lib/utils/cache";
import Pagination from "@/components/Pagination";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { Test } from "@/lib/types/test";

export default function AdminTestsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchTests = useCallback(async () => {
    console.log("[AdminTestsPage] Fetching tests");
    setLoading(true);
    setError(null);

    try {
      // Invalidate cache to ensure fresh data
      cache.invalidatePattern("^tests:");
      const data = await listTests();
      console.log("[AdminTestsPage] Tests loaded:", {
        count: data.length,
      });
      setTests(data);
    } catch (err) {
      console.error("[AdminTestsPage] Error fetching tests:", err);
      setError("Failed to load tests. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      console.log("[AdminTestsPage] No user, redirecting to login");
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      console.log("[AdminTestsPage] Non-admin user, redirecting to dashboard");
      router.replace("/dashboard");
      return;
    }

    fetchTests();
  }, [authLoading, profileLoading, user, role, router, fetchTests]);

  const handleCreateClick = useCallback(() => {
    router.push("/admin/tests/new");
  }, [router]);

  const handleDelete = useCallback(
    async (id: string) => {
      const test = tests.find((t) => t.id === id);
      const label = test ? test.title : id;

      const confirmed = typeof window !== "undefined"
        ? window.confirm(
            `Are you sure you want to delete this test?\n\n${label}`
          )
        : false;

      if (!confirmed) return;

      console.log("[AdminTestsPage] Deleting test:", id);
      setDeletingId(id);

      try {
        await deleteTest(id);
        console.log("[AdminTestsPage] Test deleted:", id);
        // Optimistically update local state
        setTests((prev) => prev.filter((t) => t.id !== id));
        setError(null); // Clear any previous errors on success
      } catch (err) {
        console.error("[AdminTestsPage] Error deleting test:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to delete test. Please try again.";
        setError(errorMessage);
        // Refresh the list to ensure consistency
        fetchTests();
      } finally {
        setDeletingId(null);
      }
    },
    [tests, fetchTests]
  );

  const handleView = useCallback(
    (id: string) => {
      router.push(`/admin/tests/${id}`);
    },
    [router]
  );

  const filteredTests = useMemo(() => {
    return tests.filter((test) =>
      test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (test.description && test.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [tests, searchQuery]);

  // Paginated tests
  const paginatedTests = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTests.slice(startIndex, endIndex);
  }, [filteredTests, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredTests.length / pageSize);
  }, [filteredTests.length, pageSize]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleViewReport = useCallback(
    (id: string) => {
      router.push(`/admin/tests/${id}/report`);
    },
    [router]
  );

  const handleMenuClick = useCallback(
    (id: string, action: "view" | "delete" | "report") => {
      if (action === "view") {
        handleView(id);
      } else if (action === "delete") {
        handleDelete(id);
      } else if (action === "report") {
        handleViewReport(id);
      }
      setOpenMenuId(null);
      setMenuPosition(null);
    },
    [handleView, handleDelete, handleViewReport]
  );

  const handleToggleMenu = useCallback((e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (openMenuId === id) {
      setOpenMenuId(null);
      setMenuPosition(null);
    } else {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right,
      });
      setOpenMenuId(id);
    }
  }, [openMenuId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-menu]') && !target.closest('button[data-dropdown-toggle]')) {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ---------- Render ----------

  if (authLoading || profileLoading) {
    return <LoadingSpinner fullScreen text="Checking admin access..." />;
  }

  if (!user || role !== "admin") {
    return <LoadingSpinner fullScreen text="Redirecting..." />;
  }

  if (loading) {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-6">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-64 bg-gray-200 rounded animate-pulse"></div>
          </div>
          
          {/* Search and Button Skeleton */}
          <div className="mb-6 flex items-center gap-4">
            <div className="h-10 flex-1 max-w-md bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
          
          {/* Table Skeleton */}
          <TableSkeleton rows={8} cols={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Tests</h1>
        <p className="text-sm text-gray-600">Create and manage your tests.</p>
      </div>

      {/* Search and Add Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={handleCreateClick}
          className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2 cursor-pointer"
          aria-label="Add new test"
        >
          <span className="text-lg">+</span>
          <span>Add New Test</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Table */}
      {filteredTests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-600 mb-4">
            {searchQuery ? "No tests found matching your search." : "No tests found."}
          </p>
          {!searchQuery && (
            <button
              onClick={handleCreateClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer"
            >
              Create your first test
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Questions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTests.map((test) => (
                <tr key={test.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{test.title}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-md truncate">
                      {test.description || "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{test.durationMinutes} min</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{test.questions.length}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => handleToggleMenu(e, test.id)}
                      data-dropdown-toggle
                      className="text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer p-1 rounded hover:bg-gray-100 transition-colors"
                      aria-label="More options"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {filteredTests.length > 0 && totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            isLoading={loading}
          />
        </div>
      )}

      {/* Dropdown Menu - Rendered outside table */}
      {openMenuId && menuPosition && (
        <div
          data-dropdown-menu
          className="fixed w-48 bg-white rounded-md shadow-xl z-[9999] border border-gray-200"
          style={{
            top: `${menuPosition.top}px`,
            right: `${menuPosition.right}px`,
          }}
        >
          <div className="py-1">
            <button
              onClick={() => handleMenuClick(openMenuId, "view")}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
            >
              View
            </button>
            <button
              onClick={() => handleMenuClick(openMenuId, "report")}
              className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
            >
              View Report
            </button>
            <button
              onClick={() => handleMenuClick(openMenuId, "delete")}
              disabled={deletingId === openMenuId}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {deletingId === openMenuId ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}






