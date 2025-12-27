// app/admin/orders/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile } from "@/lib/hooks/useUserProfile";
import { getAllUsers } from "@/lib/db/users";
import { getUserEnrollments } from "@/lib/db/students";
import { cache } from "@/lib/utils/cache";
import Pagination from "@/components/Pagination";
import { TableSkeleton, CardSkeleton } from "@/components/LoadingSkeleton";
import LoadingSpinner from "@/components/LoadingSpinner";
import type { AppUser } from "@/lib/db/users";
import type { EnrollmentWithSeries } from "@/lib/db/students";

// Note: This is a basic implementation. In a real app, orders would be stored in a separate collection.
// For now, we'll use enrollments as a proxy for orders since enrollments represent purchases/enrollments.

interface OrderData {
  id: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  testSeriesTitle: string;
  testSeriesId: string;
  amount: number;
  status: "paid" | "pending" | "free";
  date: Date;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: profileLoading } = useUserProfile();
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending" | "free">("all");
  const [filterStudent, setFilterStudent] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (authLoading || profileLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    const loadOrders = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get all students
        const allUsers = await getAllUsers();
        const students = allUsers.filter((u) => u.role !== "admin");

        // Get all enrollments for all students
        const allEnrollments: Array<{ enrollment: EnrollmentWithSeries; user: AppUser }> = [];
        
        await Promise.all(
          students.map(async (student) => {
            try {
              const enrollments = await getUserEnrollments(student.uid);
              enrollments.forEach((enrollment) => {
                allEnrollments.push({ enrollment, user: student });
              });
            } catch (err) {
              console.error(`[AdminOrdersPage] Error loading enrollments for ${student.uid}:`, err);
            }
          })
        );

        // Convert enrollments to order data
        const orderData: OrderData[] = allEnrollments.map(({ enrollment, user }) => {
          let enrolledDate: Date | null = null;
          if (enrollment.enrolledAt) {
            if (typeof enrollment.enrolledAt.toDate === "function") {
              enrolledDate = enrollment.enrolledAt.toDate();
            } else if (enrollment.enrolledAt.seconds) {
              enrolledDate = new Date(enrollment.enrolledAt.seconds * 1000);
            }
          }

          const testSeries = enrollment.testSeries;
          const amount = testSeries?.price || 0;
          const status: "paid" | "pending" | "free" = amount === 0 ? "free" : "paid";

          return {
            id: enrollment.id,
            userId: user.uid,
            studentName: user.displayName || "N/A",
            studentEmail: user.email || "N/A",
            testSeriesTitle: testSeries?.title || "Unknown Series",
            testSeriesId: enrollment.testSeriesId,
            amount,
            status,
            date: enrolledDate || new Date(),
          };
        });

        // Sort by date (newest first)
        orderData.sort((a, b) => b.date.getTime() - a.date.getTime());

        setOrders(orderData);
      } catch (err) {
        console.error("[AdminOrdersPage] Error loading orders:", err);
        setError("Failed to load orders. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [authLoading, profileLoading, user, role, router]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter((order) => order.status === filterStatus);
    }

    // Filter by student (name or email)
    if (filterStudent.trim()) {
      const query = filterStudent.toLowerCase().trim();
      filtered = filtered.filter(
        (order) =>
          order.studentName.toLowerCase().includes(query) ||
          order.studentEmail.toLowerCase().includes(query)
      );
    }

    // Filter by date range
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      filtered = filtered.filter((order) => order.date >= fromDate);
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter((order) => order.date <= toDate);
    }

    return filtered;
  }, [orders, filterStatus, filterStudent, filterDateFrom, filterDateTo]);

  // Paginated orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredOrders.length / pageSize);
  }, [filteredOrders.length, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterStudent, filterDateFrom, filterDateTo]);

  // Calculate totals
  const totals = useMemo(() => {
    const total = filteredOrders.reduce((sum, order) => sum + order.amount, 0);
    const paid = filteredOrders.filter((o) => o.status === "paid").length;
    const free = filteredOrders.filter((o) => o.status === "free").length;
    const pending = filteredOrders.filter((o) => o.status === "pending").length;

    return { total, paid, free, pending, count: filteredOrders.length };
  }, [filteredOrders]);

  if (authLoading || profileLoading) {
    return <LoadingSpinner fullScreen text="Checking access..." />;
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
          
          {/* Summary Cards Skeleton */}
          <CardSkeleton count={5} />
          
          {/* Filters Skeleton */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
          
          {/* Table Skeleton */}
          <div className="mt-6">
            <TableSkeleton rows={8} cols={6} />
          </div>
        </div>
      </div>
    );
  }

  if (!user || role !== "admin") {
    return (
      <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Orders</h1>
          <p className="text-sm text-gray-600">View and manage customer orders and enrollments.</p>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900">Total Orders</p>
            <p className="text-2xl font-bold text-blue-700">{totals.count}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-900">Paid</p>
            <p className="text-2xl font-bold text-green-700">{totals.paid}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900">Free</p>
            <p className="text-2xl font-bold text-gray-700">{totals.free}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm font-medium text-yellow-900">Pending</p>
            <p className="text-2xl font-bold text-yellow-700">{totals.pending}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm font-medium text-purple-900">Total Revenue</p>
            <p className="text-2xl font-bold text-purple-700">${totals.total.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-1 text-xs font-medium text-gray-700">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="free">Free</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium text-gray-700">Student</label>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={filterStudent}
                onChange={(e) => setFilterStudent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium text-gray-700">Date From</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block mb-1 text-xs font-medium text-gray-700">Date To</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Results Count and Page Size */}
        {filteredOrders.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {paginatedOrders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Items per page:</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        )}

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600">
              {orders.length === 0
                ? "No orders found."
                : "No orders match your filters."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Test Series
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-mono text-gray-500">{order.id.slice(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{order.studentName}</div>
                        <div className="text-xs text-gray-500">{order.studentEmail}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{order.testSeriesTitle}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ${order.amount.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            order.status === "paid"
                              ? "bg-green-100 text-green-800"
                              : order.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {order.date.toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {filteredOrders.length > 0 && totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isLoading={loading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
