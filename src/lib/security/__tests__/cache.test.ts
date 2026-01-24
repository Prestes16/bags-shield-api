/**
 * Tests for TTL cache utilities
 */

import { TTLCache, CacheKeyGenerator, LocalStorageInterface, CacheUtils } from '../cache';

describe('TTLCache', () => {
  let cache: TTLCache<string>;

  beforeEach(() => {
    cache = new TTLCache<string>(3, 100); // Small size and short TTL for testing
  });

  describe('basic operations', () => {
    test('sets and gets values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('returns undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    test('has() returns correct boolean', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    test('delete() removes entries', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    test('clear() removes all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL behavior', () => {
    test('expires entries after TTL', async () => {
      cache.set('key1', 'value1', 50); // 50ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 60)); // Wait for expiration
      expect(cache.get('key1')).toBeUndefined();
    });

    test('uses default TTL when not specified', async () => {
      cache.set('key1', 'value1'); // Uses default 100ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 110)); // Wait for expiration
      expect(cache.get('key1')).toBeUndefined();
    });

    test('custom TTL overrides default', async () => {
      cache.set('key1', 'value1', 200); // 200ms TTL
      
      await new Promise(resolve => setTimeout(resolve, 110)); // Default TTL would expire
      expect(cache.get('key1')).toBe('value1'); // Should still exist
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Total 210ms
      expect(cache.get('key1')).toBeUndefined(); // Now should be expired
    });
  });

  describe('size limits and eviction', () => {
    test('evicts oldest entries when cache is full', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.size()).toBe(3);
      
      // Adding 4th item should evict the first
      cache.set('key4', 'value4');
      expect(cache.size()).toBe(3);
      expect(cache.get('key1')).toBeUndefined(); // Oldest should be evicted
      expect(cache.get('key4')).toBe('value4'); // New item should exist
    });

    test('evictExpired() removes only expired entries', async () => {
      cache.set('key1', 'value1', 50); // Short TTL
      cache.set('key2', 'value2', 200); // Long TTL
      
      await new Promise(resolve => setTimeout(resolve, 60)); // key1 should expire
      
      const evicted = cache.evictExpired();
      expect(evicted).toBe(1);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('statistics', () => {
    test('tracks hits and misses', () => {
      cache.set('key1', 'value1');
      
      cache.get('key1'); // Hit
      cache.get('nonexistent'); // Miss
      cache.get('key1'); // Hit
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    test('tracks evictions', () => {
      // Fill cache
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      const initialStats = cache.getStats();
      
      // Force eviction
      cache.set('key4', 'value4');
      
      const finalStats = cache.getStats();
      expect(finalStats.evictions).toBe(initialStats.evictions + 1);
    });

    test('tracks cache size correctly', () => {
      const stats1 = cache.getStats();
      expect(stats1.size).toBe(0);
      
      cache.set('key1', 'value1');
      const stats2 = cache.getStats();
      expect(stats2.size).toBe(1);
      
      cache.delete('key1');
      const stats3 = cache.getStats();
      expect(stats3.size).toBe(0);
    });
  });

  describe('utility methods', () => {
    test('keys() returns array of current keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const keys = cache.keys();
      expect(keys).toEqual(expect.arrayContaining(['key1', 'key2']));
      expect(keys.length).toBe(2);
    });

    test('size() returns current cache size', () => {
      expect(cache.size()).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });
  });
});

describe('CacheKeyGenerator', () => {
  test('generates attestation keys', () => {
    const key1 = CacheKeyGenerator.attestation('mint123');
    const key2 = CacheKeyGenerator.attestation('mint123', 'snapshot456');
    
    expect(key1).toBe('attest:mint123:latest');
    expect(key2).toBe('attest:mint123:snapshot456');
  });

  test('generates validation keys', () => {
    const key = CacheKeyGenerator.validation('mint', 'address123');
    expect(key).toBe('valid:mint:address123');
  });

  test('generates rate limit keys', () => {
    const key = CacheKeyGenerator.rateLimit('192.168.1.1', '/api/submit');
    expect(key).toBe('rate:192.168.1.1:/api/submit');
  });

  test('generates SSRF keys', () => {
    const key = CacheKeyGenerator.ssrf('https://example.com/path');
    expect(key).toMatch(/^ssrf:/);
    expect(key.length).toBeLessThanOrEqual(38); // ssrf: + 32 chars max
  });
});

describe('LocalStorageInterface', () => {
  let storage: LocalStorageInterface;
  
  // Mock localStorage
  const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        store = {};
      }),
      key: jest.fn((index: number) => Object.keys(store)[index] || null),
      get length() {
        return Object.keys(store).length;
      }
    };
  })();

  beforeEach(() => {
    storage = new LocalStorageInterface('test_');
    
    // Mock window.localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    
    // Clear mock calls
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  test('setItem stores values with expiration', () => {
    const result = storage.setItem('key1', 'value1', 1000);
    expect(result).toBe(true);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'test_key1',
      expect.stringContaining('"value":"value1"')
    );
  });

  test('getItem retrieves non-expired values', () => {
    storage.setItem('key1', 'value1', 10000); // Long TTL
    const value = storage.getItem('key1');
    expect(value).toBe('value1');
  });

  test('getItem returns null for expired values', () => {
    // Mock an expired item
    const expiredItem = JSON.stringify({
      value: 'value1',
      expiresAt: Date.now() - 1000, // Expired 1 second ago
      createdAt: Date.now() - 2000
    });
    
    mockLocalStorage.setItem('test_key1', expiredItem);
    
    const value = storage.getItem('key1');
    expect(value).toBeNull();
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test_key1');
  });

  test('getItem handles items without expiration', () => {
    storage.setItem('key1', 'value1'); // No TTL
    const value = storage.getItem('key1');
    expect(value).toBe('value1');
  });

  test('removeItem deletes stored values', () => {
    storage.setItem('key1', 'value1');
    const result = storage.removeItem('key1');
    expect(result).toBe(true);
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test_key1');
  });

  test('clear removes all items with prefix', () => {
    mockLocalStorage.setItem('test_key1', 'value1');
    mockLocalStorage.setItem('test_key2', 'value2');
    mockLocalStorage.setItem('other_key', 'value3');
    
    // Mock the key() method to return our test keys
    mockLocalStorage.key = jest.fn()
      .mockReturnValueOnce('test_key1')
      .mockReturnValueOnce('test_key2')
      .mockReturnValueOnce('other_key')
      .mockReturnValue(null);
    
    Object.defineProperty(mockLocalStorage, 'length', {
      get: () => 3
    });

    const result = storage.clear();
    expect(result).toBe(true);
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test_key1');
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test_key2');
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other_key');
  });

  test('handles localStorage unavailable gracefully', () => {
    // Mock localStorage as undefined
    Object.defineProperty(window, 'localStorage', {
      value: undefined,
      writable: true
    });

    expect(storage.setItem('key1', 'value1')).toBe(false);
    expect(storage.getItem('key1')).toBeNull();
    expect(storage.removeItem('key1')).toBe(false);
    expect(storage.clear()).toBe(false);
  });
});

describe('CacheUtils', () => {
  let cache: TTLCache;

  beforeEach(() => {
    cache = new TTLCache(10, 100);
  });

  describe('memoize', () => {
    test('caches function results', () => {
      let callCount = 0;
      const expensiveFunction = jest.fn((x: number) => {
        callCount++;
        return x * 2;
      });

      const memoized = CacheUtils.memoize(expensiveFunction, cache);

      // First call should execute function
      expect(memoized(5)).toBe(10);
      expect(callCount).toBe(1);

      // Second call with same args should use cache
      expect(memoized(5)).toBe(10);
      expect(callCount).toBe(1); // No additional calls

      // Different args should execute function again
      expect(memoized(3)).toBe(6);
      expect(callCount).toBe(2);
    });

    test('uses custom key generator', () => {
      const fn = jest.fn((obj: {a: number, b: number}) => obj.a + obj.b);
      const keyGen = (obj: {a: number, b: number}) => `${obj.a}-${obj.b}`;
      
      const memoized = CacheUtils.memoize(fn, cache, keyGen);

      memoized({a: 1, b: 2});
      memoized({a: 1, b: 2}); // Should use cache

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('cached', () => {
    test('caches synchronous function results', () => {
      let callCount = 0;
      const fn = () => {
        callCount++;
        return 'result';
      };

      // First call should execute function
      const result1 = CacheUtils.cached('test-key', fn, 1000, cache);
      expect(result1).toBe('result');
      expect(callCount).toBe(1);

      // Second call should use cache
      const result2 = CacheUtils.cached('test-key', fn, 1000, cache);
      expect(result2).toBe('result');
      expect(callCount).toBe(1); // No additional calls
    });

    test('caches asynchronous function results', async () => {
      let callCount = 0;
      const asyncFn = async () => {
        callCount++;
        return 'async-result';
      };

      // First call should execute function
      const result1 = await CacheUtils.cached('async-key', asyncFn, 1000, cache);
      expect(result1).toBe('async-result');
      expect(callCount).toBe(1);

      // Second call should use cache
      const result2 = await CacheUtils.cached('async-key', asyncFn, 1000, cache);
      expect(result2).toBe('async-result');
      expect(callCount).toBe(1); // No additional calls
    });
  });
});