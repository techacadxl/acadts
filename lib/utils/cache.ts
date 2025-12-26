// lib/utils/cache.ts
// Simple in-memory cache with TTL for Firestore queries

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Expired, remove it
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Invalidate a specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const cache = new SimpleCache();

/**
 * Cache key generators
 */
export const cacheKeys = {
  questions: (params?: Record<string, any>) => 
    `questions:${JSON.stringify(params || {})}`,
  question: (id: string) => `question:${id}`,
  tests: (params?: Record<string, any>) => 
    `tests:${JSON.stringify(params || {})}`,
  test: (id: string) => `test:${id}`,
  testSeries: (params?: Record<string, any>) => 
    `testSeries:${JSON.stringify(params || {})}`,
  testSeriesById: (id: string) => `testSeries:${id}`,
  publishedTestSeries: () => `publishedTestSeries`,
  enrollments: (userId: string) => `enrollments:${userId}`,
  testResults: (userId: string) => `testResults:${userId}`,
  testResult: (id: string) => `testResult:${id}`,
};

