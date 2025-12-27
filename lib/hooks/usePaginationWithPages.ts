// lib/hooks/usePaginationWithPages.ts
import { useState, useCallback, useEffect, useMemo } from "react";

export interface PaginationState<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  isLoading: boolean;
  hasMore: boolean;
  hasPrevious: boolean;
}

export interface UsePaginationWithPagesOptions<T> {
  fetchFn: (page: number, pageSize: number) => Promise<{
    items: T[];
    total?: number;
    hasMore?: boolean;
  }>;
  pageSize?: number;
  initialPage?: number;
  enableCache?: boolean;
}

export function usePaginationWithPages<T>({
  fetchFn,
  pageSize = 20,
  initialPage = 1,
  enableCache = true,
}: UsePaginationWithPagesOptions<T>): PaginationState<T> & {
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
  setPageSize: (size: number) => void;
} {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [items, setItems] = useState<T[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  
  // Cache for pages
  const pageCache = useMemo(() => new Map<number, { items: T[]; total?: number }>(), []);

  const loadPage = useCallback(
    async (page: number, size: number, useCache: boolean = true) => {
      setIsLoading(true);
      
      try {
        // Check cache first
        if (enableCache && useCache && pageCache.has(page) && size === currentPageSize) {
          const cached = pageCache.get(page)!;
          setItems(cached.items);
          if (cached.total !== undefined) {
            setTotalItems(cached.total);
          }
          setIsLoading(false);
          return;
        }

        const result = await fetchFn(page, size);
        
        setItems(result.items);
        
        if (result.total !== undefined) {
          setTotalItems(result.total);
        } else {
          // Estimate total from items and hasMore
          if (result.hasMore === false) {
            setTotalItems((page - 1) * size + result.items.length);
          }
        }
        
        setHasMore(result.hasMore ?? true);
        
        // Cache the result
        if (enableCache) {
          pageCache.set(page, { items: result.items, total: result.total });
        }
      } catch (error) {
        console.error("[usePaginationWithPages] Error loading page:", error);
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchFn, enableCache, pageCache, currentPageSize]
  );

  // Load page when currentPage or pageSize changes
  useEffect(() => {
    loadPage(currentPage, currentPageSize, true);
  }, [currentPage, currentPageSize, loadPage]);

  const goToPage = useCallback(
    (page: number) => {
      if (page < 1) return;
      setCurrentPage(page);
    },
    []
  );

  const nextPage = useCallback(() => {
    if (hasMore && !isLoading) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasMore, isLoading]);

  const prevPage = useCallback(() => {
    if (currentPage > 1 && !isLoading) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage, isLoading]);

  const refresh = useCallback(() => {
    // Clear cache for current page
    if (enableCache) {
      pageCache.delete(currentPage);
    }
    loadPage(currentPage, currentPageSize, false);
  }, [currentPage, currentPageSize, loadPage, enableCache, pageCache]);

  const setPageSize = useCallback((size: number) => {
    if (size < 1) return;
    setCurrentPageSize(size);
    // Clear cache when page size changes
    if (enableCache) {
      pageCache.clear();
    }
    setCurrentPage(1); // Reset to first page
  }, [enableCache, pageCache]);

  const totalPages = useMemo(() => {
    if (totalItems === 0) return 1;
    return Math.ceil(totalItems / currentPageSize);
  }, [totalItems, currentPageSize]);

  const hasPrevious = currentPage > 1;

  return {
    items,
    currentPage,
    totalPages,
    totalItems,
    pageSize: currentPageSize,
    isLoading,
    hasMore,
    hasPrevious,
    goToPage,
    nextPage,
    prevPage,
    refresh,
    setPageSize,
  };
}

