// lib/hooks/usePagination.ts
import { useState, useCallback } from "react";

export interface UsePaginationReturn<T> {
  currentPage: number;
  totalPages: number;
  items: T[];
  isLoading: boolean;
  hasMore: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
}

export function usePagination<T>(
  fetchFn: (page: number, lastDoc?: any) => Promise<{ items: T[]; lastDoc: any; hasMore: boolean }>,
  pageSize: number = 20
): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const loadPage = useCallback(
    async (page: number, reset: boolean = false) => {
      setIsLoading(true);
      try {
        const result = await fetchFn(page, reset ? undefined : lastDoc);
        if (reset) {
          setItems(result.items);
        } else {
          setItems((prev) => [...prev, ...result.items]);
        }
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
      } catch (error) {
        console.error("[usePagination] Error loading page:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchFn, lastDoc]
  );

  const goToPage = useCallback(
    (page: number) => {
      if (page < 1 || (page > currentPage && !hasMore)) return;
      setCurrentPage(page);
      loadPage(page, page === 1);
    },
    [currentPage, hasMore, loadPage]
  );

  const nextPage = useCallback(() => {
    if (hasMore && !isLoading) {
      const next = currentPage + 1;
      setCurrentPage(next);
      loadPage(next);
    }
  }, [currentPage, hasMore, isLoading, loadPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      const prev = currentPage - 1;
      setCurrentPage(prev);
      // For simplicity, we'll reload from start
      // In production, you might want to cache previous pages
      loadPage(prev, true);
    }
  }, [currentPage, loadPage]);

  const refresh = useCallback(() => {
    setCurrentPage(1);
    setItems([]);
    setLastDoc(null);
    setHasMore(true);
    loadPage(1, true);
  }, [loadPage]);

  // Calculate total pages (approximate)
  const totalPages = Math.ceil(items.length / pageSize) + (hasMore ? 1 : 0);

  return {
    currentPage,
    totalPages,
    items,
    isLoading,
    hasMore,
    goToPage,
    nextPage,
    prevPage,
    refresh,
  };
}


