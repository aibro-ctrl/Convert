// Simple in-memory cache for API responses
// Cache duration: 5 minutes for most data, 1 minute for frequently changing data

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  duration: number;
}

class APICache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  
  // Cache durations in milliseconds
  static readonly DURATION_SHORT = 60000; // 1 minute
  static readonly DURATION_MEDIUM = 300000; // 5 minutes
  static readonly DURATION_LONG = 1800000; // 30 minutes

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > entry.duration) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T, duration: number = APICache.DURATION_MEDIUM): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      duration,
    });
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    
    // Remove entries matching pattern
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const apiCache = new APICache();

// Export class for constants
export { APICache };

// Helper to create cache key from endpoint and params
export function createCacheKey(endpoint: string, params?: Record<string, any>): string {
  const paramStr = params ? JSON.stringify(params) : '';
  return `${endpoint}${paramStr}`;
}

