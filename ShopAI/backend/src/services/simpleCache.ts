/**
 * Simple LRU Cache with TTL support
 * Used for caching search results and AI responses
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number; // milliseconds
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 1000, ttl: number = 600000) { // 10 min default
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    entry.hits++;
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiry
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  private evictOldest(): void {
    // Find entry with oldest timestamp and lowest hits
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();
    let lowestHits = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp || 
          (entry.timestamp === oldestTimestamp && entry.hits < lowestHits)) {
        oldestKey = key;
        oldestTimestamp = entry.timestamp;
        lowestHits = entry.hits;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  size(): number {
    return this.cache.size;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%',
      ttl: this.ttl
    };
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }
}
