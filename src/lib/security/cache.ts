/**
 * TTL cache utilities for Launchpad security
 * In-memory cache with TTL support and localStorage interface for frontend usage notes
 */

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxSize: number;
}

/**
 * TTL Cache implementation
 */
export class TTLCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private stats: CacheStats;
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) { // 5 minutes default
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      maxSize,
    };
  }

  /**
   * Set value with TTL
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    // Evict expired entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictExpired();
      
      // If still full after eviction, remove oldest entry
      if (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
          this.cache.delete(oldestKey);
          this.stats.evictions++;
        }
      }
    }

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: now,
    });

    this.stats.size = this.cache.size;
  }

  /**
   * Get value if not expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    const now = Date.now();
    
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.stats.size = this.cache.size;
      return undefined;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return deleted;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.evictions += this.stats.size;
  }

  /**
   * Evict expired entries
   */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        evicted++;
      }
    }

    this.stats.evictions += evicted;
    this.stats.size = this.cache.size;
    return evicted;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get all keys (for debugging)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Default cache instances for different use cases
 */
export const attestationCache = new TTLCache<any>(500, 300000); // 5 minutes
export const validationCache = new TTLCache<any>(1000, 600000); // 10 minutes
export const rateLimitCache = new TTLCache<number>(10000, 60000); // 1 minute

/**
 * Cache key generators
 */
export class CacheKeyGenerator {
  /**
   * Generate key for attestation cache
   */
  static attestation(mint: string, snapshot?: string): string {
    return `attest:${mint}:${snapshot || 'latest'}`;
  }

  /**
   * Generate key for validation cache
   */
  static validation(type: string, value: string): string {
    return `valid:${type}:${value}`;
  }

  /**
   * Generate key for rate limiting
   */
  static rateLimit(ip: string, endpoint: string): string {
    return `rate:${ip}:${endpoint}`;
  }

  /**
   * Generate key for SSRF validation
   */
  static ssrf(url: string): string {
    return `ssrf:${Buffer.from(url).toString('base64').slice(0, 32)}`;
  }
}

/**
 * LocalStorage interface for frontend usage notes
 * This provides a consistent interface but should only be used on the frontend
 */
export class LocalStorageInterface {
  private prefix: string;

  constructor(prefix: string = 'launchpad_') {
    this.prefix = prefix;
  }

  /**
   * Check if localStorage is available
   */
  private isAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      
      // Test localStorage functionality
      const testKey = '__ls_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set item with expiration
   */
  setItem(key: string, value: any, ttlMs?: number): boolean {
    if (!this.isAvailable()) return false;

    try {
      const item = {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : null,
        createdAt: Date.now(),
      };

      window.localStorage.setItem(this.prefix + key, JSON.stringify(item));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get item if not expired
   */
  getItem(key: string): any | null {
    if (!this.isAvailable()) return null;

    try {
      const stored = window.localStorage.getItem(this.prefix + key);
      if (!stored) return null;

      const item = JSON.parse(stored);
      
      // Check expiration
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.removeItem(key);
        return null;
      }

      return item.value;
    } catch {
      return null;
    }
  }

  /**
   * Remove item
   */
  removeItem(key: string): boolean {
    if (!this.isAvailable()) return false;

    try {
      window.localStorage.removeItem(this.prefix + key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all items with prefix
   */
  clear(): boolean {
    if (!this.isAvailable()) return false;

    try {
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => window.localStorage.removeItem(key));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get usage statistics
   */
  getStats(): { itemCount: number; totalSize: number } {
    if (!this.isAvailable()) return { itemCount: 0, totalSize: 0 };

    let itemCount = 0;
    let totalSize = 0;

    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          itemCount++;
          const value = window.localStorage.getItem(key);
          if (value) {
            totalSize += key.length + value.length;
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return { itemCount, totalSize };
  }
}

/**
 * Default localStorage interface instance
 */
export const defaultLocalStorage = new LocalStorageInterface('launchpad_');

/**
 * Cache cleanup utility
 */
export class CacheCleanup {
  private static instance: CacheCleanup;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): CacheCleanup {
    if (!CacheCleanup.instance) {
      CacheCleanup.instance = new CacheCleanup();
    }
    return CacheCleanup.instance;
  }

  /**
   * Start automatic cleanup
   */
  startCleanup(intervalMs: number = 60000): void { // 1 minute default
    if (this.cleanupInterval) {
      this.stopCleanup();
    }

    this.cleanupInterval = setInterval(() => {
      attestationCache.evictExpired();
      validationCache.evictExpired();
      rateLimitCache.evictExpired();
    }, intervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Manual cleanup all caches
   */
  cleanupAll(): void {
    attestationCache.evictExpired();
    validationCache.evictExpired();
    rateLimitCache.evictExpired();
  }
}

/**
 * Cache utility functions
 */
export const CacheUtils = {
  /**
   * Memoize function with TTL cache
   */
  memoize<T extends (...args: any[]) => any>(
    fn: T,
    cache: TTLCache = validationCache,
    keyGenerator: (...args: Parameters<T>) => string = (...args) => JSON.stringify(args)
  ): T {
    return ((...args: Parameters<T>) => {
      const key = keyGenerator(...args);
      
      let result = cache.get(key);
      if (result === undefined) {
        result = fn(...args);
        cache.set(key, result);
      }
      
      return result;
    }) as T;
  },

  /**
   * Cache function with custom TTL
   */
  cached<T>(
    key: string, 
    fn: () => T | Promise<T>, 
    ttl: number,
    cache: TTLCache = validationCache
  ): T | Promise<T> {
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = fn();
    
    if (result instanceof Promise) {
      return result.then(resolved => {
        cache.set(key, resolved, ttl);
        return resolved;
      });
    } else {
      cache.set(key, result, ttl);
      return result;
    }
  }
};