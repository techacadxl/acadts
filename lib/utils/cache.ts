// lib/utils/cache.ts
// Enhanced in-memory cache with TTL, LRU eviction, and size limits

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number; // For LRU tracking
  lastAccessed: number; // Last access time
}

class EnhancedCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 10 * 60 * 1000; // 10 minutes default (increased for better performance)
  private maxSize: number = 1000; // Maximum number of cache entries (increased)
  private maxMemoryMB: number = 100; // Maximum memory in MB (approximate, increased)

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

    // Update access tracking for LRU
    entry.accessCount++;
    entry.lastAccessed = now;

    return entry.data as T;
  }

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Check if we need to evict entries
    this.evictIfNeeded();

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Evict entries if cache is too large
   */
  private evictIfNeeded(): void {
    // Evict expired entries first
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }

    // If still too large, use LRU eviction
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      // Sort by last accessed (oldest first)
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      // Remove 20% of least recently used entries
      const toRemove = Math.floor(this.maxSize * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
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

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let totalAccess = 0;
    
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expired++;
      }
      totalAccess += entry.accessCount;
    }

    return {
      size: this.cache.size,
      expired,
      totalAccess,
      maxSize: this.maxSize,
    };
  }
}

// Singleton instance
export const cache = new EnhancedCache();

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
  users: (params?: Record<string, any>) => 
    `users:${JSON.stringify(params || {})}`,
  user: (id: string) => `user:${id}`,
};
