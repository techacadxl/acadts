// components/LoadingSkeleton.tsx
"use client";

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className = "", width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      style={{ width, height }}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-6 py-3">
                  <Skeleton height="16px" width="80px" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50">
                {Array.from({ length: cols }).map((_, colIdx) => (
                  <td key={colIdx} className="px-6 py-4">
                    <Skeleton height="16px" width={colIdx === 0 ? "120px" : "80px"} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
          <Skeleton height="14px" width="100px" className="mb-2" />
          <Skeleton height="32px" width="80px" className="mb-2" />
          <Skeleton height="12px" width="120px" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Skeleton height="20px" width="200px" className="mb-2" />
              <Skeleton height="16px" width="150px" />
            </div>
            <Skeleton height="32px" width="80px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="pt-16 md:pt-8 p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Skeleton height="32px" width="200px" className="mb-2" />
          <Skeleton height="16px" width="300px" />
        </div>

        {/* Cards */}
        <CardSkeleton count={4} className="mb-6" />

        {/* Table */}
        <TableSkeleton rows={8} cols={6} />
      </div>
    </div>
  );
}

