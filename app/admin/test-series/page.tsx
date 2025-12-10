// app/admin/test-series/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { listTestSeries, deleteTestSeries } from "@/lib/db/testSeries";
import type { TestSeries } from "@/lib/types/testSeries";

export default function AdminTestSeriesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [testSeries, setTestSeries] = useState<TestSeries[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);

  const fetchTestSeries = useCallback(async () => {
    console.log("[AdminTestSeriesPage] Fetching test series");
    setLoading(true);
    setError(null);

    try {
      const data = await listTestSeries();
      console.log("[AdminTestSeriesPage] Test series loaded:", {
        count: data.length,
      });
      setTestSeries(data);
    } catch (err) {
      console.error("[AdminTestSeriesPage] Error fetching test series:", err);
      setError("Failed to load test series. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      console.log("[AdminTestSeriesPage] No user, redirecting to login");
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      console.log("[AdminTestSeriesPage] Non-admin user, redirecting to dashboard");
      router.replace("/dashboard");
      return;
    }

    fetchTestSeries();
  }, [authLoading, profileLoading, user, role, router, fetchTestSeries]);

  const handleCreateClick = useCallback(() => {
    router.push("/admin/test-series/new");
  }, [router]);

  const handleDelete = useCallback(
    async (id: string) => {
      const series = testSeries.find((s) => s.id === id);
      const label = series ? series.title : id;

      const confirmed = typeof window !== "undefined"
        ? window.confirm(
            `Are you sure you want to delete this test series?\n\n${label}`
          )
        : false;

      if (!confirmed) return;

      console.log("[AdminTestSeriesPage] Deleting test series:", id);
      setDeletingId(id);

      try {
        await deleteTestSeries(id);
        console.log("[AdminTestSeriesPage] Test series deleted:", id);
        // Optimistically update local state
        setTestSeries((prev) => prev.filter((s) => s.id !== id));
        setError(null); // Clear any previous errors on success
      } catch (err) {
        console.error("[AdminTestSeriesPage] Error deleting test series:", err);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to delete test series. Please try again.";
        setError(errorMessage);
        // Refresh the list to ensure consistency
        fetchTestSeries();
      } finally {
        setDeletingId(null);
      }
    },
    [testSeries, fetchTestSeries]
  );

  const handleView = useCallback(
    (id: string) => {
      router.push(`/admin/test-series/${id}`);
    },
    [router]
  );

  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/admin/test-series/${id}/edit`);
    },
    [router]
  );

  const filteredTestSeries = testSeries.filter((series) =>
    series.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMenuClick = useCallback(
    (id: string, action: "view" | "edit" | "delete" | "students") => {
      if (action === "view") {
        handleView(id);
      } else if (action === "edit") {
        handleEdit(id);
      } else if (action === "delete") {
        handleDelete(id);
      } else if (action === "students") {
        router.push(`/admin/test-series/${id}/students`);
      }
      setOpenMenuId(null);
      setMenuPosition(null);
    },
    [handleView, handleEdit, handleDelete, router]
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

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading test series...</p>
      </div>
    );
  }

  return (
    <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Test Series</h1>
        <p className="text-sm text-gray-600">Create and manage your test series.</p>
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
          aria-label="Add new series"
        >
          <span className="text-lg">+</span>
          <span>Add New Series</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Table */}
      {filteredTestSeries.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-600 mb-4">
            {searchQuery ? "No test series found matching your search." : "No test series found."}
          </p>
          {!searchQuery && (
            <button
              onClick={handleCreateClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer"
            >
              Create your first test series
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
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Subjects
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTestSeries.map((series) => (
                <tr key={series.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{series.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">12th</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">PCM</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ${series.price?.toFixed(2) || "0.00"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => handleToggleMenu(e, series.id)}
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
              onClick={() => handleMenuClick(openMenuId, "edit")}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => handleMenuClick(openMenuId, "students")}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors"
            >
              View Enrolled Students
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


