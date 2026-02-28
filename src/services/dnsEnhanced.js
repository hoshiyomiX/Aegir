/**
 * Enhanced DNS Resolution with Failover, Stale-While-Revalidate, and Negative Caching
 * Improvements: Multiple DoH resolvers, request coalescing, predictive resolution,
 * stale-while-revalidate pattern, negative caching
 */

import { dnsCache, dnsStats } from '../core/state.js';
import { DNS_RESOLVER, DNS_CACHE_TTL, KNOWN_DOMAINS } from '../config/constants.js';

// ============ DNS CONFIGURATION ============

export const DNS_CONFIG = {
  // Primary and secondary DoH resolvers
  resolvers: [
    { url: 'https://cloudflare-dns.com/dns-query', name: 'cloudflare', priority: 1 },
    { url: 'https://dns.google/resolve', name: 'google', priority: 2 },
    { url: 'https://dns.quad9.net/dns-query', name: 'quad9', priority: 3 }
  ],
  
  // Cache settings
  cacheTTL: DNS_CACHE_TTL,           // 10 minutes for positive responses
  negativeCacheTTL: 300000,          // 5 minutes for negative responses (NXDOMAIN)
  staleTTL: 60000,                   // 1 minute to serve stale while revalidating
  
  // Request settings
  timeout: 5000,                     // 5 seconds timeout per resolver
  concurrentQueries: 2,              // Query this many resolvers concurrently
  
  // Retry settings
  maxRetries: 2,
  retryDelay: 1000,
  
  // Known domains for predictive warming
  predictiveDomains: KNOWN_DOMAINS,
  
  // Coalescing window
  coalesceWindow: 100                // 100ms window to coalesce identical queries
};

// ============ DNS CACHE ENTRY ============

class DNSCacheEntry {
  constructor(ip, options = {}) {
    this.ip = ip;
    this.timestamp = Date.now();
    this.ttl = options.ttl || DNS_CONFIG.cacheTTL;
    this.isNegative = options.isNegative || false;
    this.source = options.source || 'doh';
    this.resolver = options.resolver || 'unknown';
    this.queryTime = options.queryTime || 0;
    this.accessCount = 0;
    this.lastAccess = Date.now();
    this.isStale = false;
  }

  /**
   * Check if entry is expired
   */
  isExpired() {
    const ttl = this.isNegative ? DNS_CONFIG.negativeCacheTTL : this.ttl;
    return Date.now() - this.timestamp > ttl;
  }

  /**
   * Check if entry is stale (but usable for stale-while-revalidate)
   */
  isStaleButUsable() {
    const staleTime = this.timestamp + this.ttl;
    const deadTime = staleTime + DNS_CONFIG.staleTTL;
    const now = Date.now();
    return now > staleTime && now < deadTime;
  }

  /**
   * Record access
   */
  recordAccess() {
    this.accessCount++;
    this.lastAccess = Date.now();
  }

  /**
   * Mark as stale for revalidation
   */
  markStale() {
    this.isStale = true;
  }
}

// ============ REQUEST COALESCER ============

class DNSRequestCoalescer {
  constructor() {
    this.pending = new Map();
    this.stats = {
      coalesced: 0,
      unique: 0
    };
  }

  /**
   * Get existing promise or create new one
   */
  async coalesce(hostname, resolver) {
    const key = `${hostname}:${resolver}`;
    
    if (this.pending.has(key)) {
      this.stats.coalesced++;
      return this.pending.get(key);
    }
    
    this.stats.unique++;
    const promise = resolver(hostname);
    this.pending.set(key, promise);
    
    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up after resolution
      setTimeout(() => this.pending.delete(key), DNS_CONFIG.coalesceWindow);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      pendingCount: this.pending.size,
      ...this.stats
    };
  }
}

// ============ ENHANCED DNS RESOLVER ============

export class EnhancedDNSResolver {
  constructor(config = {}) {
    this.config = { ...DNS_CONFIG, ...config };
    this.cache = new Map();
    this.coalescer = new DNSRequestCoalescer();
    this.stats = {
      hits: 0,
      misses: 0,
      staleHits: 0,
      negativeHits: 0,
      resolverStats: {},
      predictiveResolutions: 0,
      failedResolutions: 0
    };
    
    // Initialize resolver stats
    for (const resolver of this.config.resolvers) {
      this.stats.resolverStats[resolver.name] = {
        queries: 0,
        successes: 0,
        failures: 0,
        avgLatency: 0
      };
    }
  }

  /**
   * Resolve hostname with full optimization pipeline
   */
  async resolve(hostname, options = {}) {
    const now = Date.now();
    
    // Check cache first
    const cached = this.cache.get(hostname);
    
    if (cached) {
      // Check if entry is still valid
      if (!cached.isExpired()) {
        cached.recordAccess();
        
        if (cached.isNegative) {
          this.stats.negativeHits++;
          return { ip: null, fromCache: true, isNegative: true };
        }
        
        this.stats.hits++;
        return { ip: cached.ip, fromCache: true, isStale: cached.isStaleButUsable() };
      }
      
      // Check if stale but usable (stale-while-revalidate)
      if (cached.isStaleButUsable() && !cached.isNegative) {
        cached.markStale();
        cached.recordAccess();
        this.stats.staleHits++;
        
        // Trigger background revalidation
        this._revalidateInBackground(hostname);
        
        return { ip: cached.ip, fromCache: true, isStale: true };
      }
    }
    
    this.stats.misses++;
    
    // Perform resolution with failover
    return await this._resolveWithFailover(hostname, options);
  }

  /**
   * Resolve with multiple resolver failover
   */
  async _resolveWithFailover(hostname, options = {}) {
    const resolvers = this.config.resolvers
      .sort((a, b) => a.priority - b.priority)
      .slice(0, this.config.concurrentQueries);
    
    // Try resolvers concurrently (race)
    const promises = resolvers.map(resolver => 
      this._queryResolver(hostname, resolver)
        .then(result => ({ ...result, resolver: resolver.name }))
        .catch(error => ({ error, resolver: resolver.name }))
    );
    
    try {
      // Wait for first successful response
      const results = await Promise.allSettled(promises);
      
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.ip) {
          const { ip, queryTime, resolver } = result.value;
          
          // Cache the result
          const entry = new DNSCacheEntry(ip, {
            queryTime,
            resolver,
            source: 'doh'
          });
          this.cache.set(hostname, entry);
          
          return { ip, fromCache: false, resolver };
        }
      }
      
      // All resolvers failed - cache negative result
      this._cacheNegative(hostname);
      return { ip: null, fromCache: false, isNegative: true, error: 'All resolvers failed' };
      
    } catch (error) {
      this.stats.failedResolutions++;
      return { ip: hostname, fromCache: false, error: error.message };
    }
  }

  /**
   * Query a specific DoH resolver
   */
  async _queryResolver(hostname, resolver) {
    const startTime = Date.now();
    const stats = this.stats.resolverStats[resolver.name];
    stats.queries++;
    
    try {
      const url = `${resolver.url}?name=${hostname}&type=A`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/dns-json' },
        signal: controller.signal,
        cf: {
          cacheTtl: 600,
          cacheEverything: true
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const queryTime = Date.now() - startTime;
      
      // Update stats
      stats.successes++;
      stats.avgLatency = Math.round((stats.avgLatency + queryTime) / 2);
      
      // Extract A record
      if (data.Answer && data.Answer.length > 0) {
        const aRecord = data.Answer.find(r => r.type === 1);
        if (aRecord && aRecord.data) {
          return { ip: aRecord.data, queryTime };
        }
      }
      
      // No A record found
      return { ip: null, queryTime };
      
    } catch (error) {
      stats.failures++;
      throw error;
    }
  }

  /**
   * Cache negative result
   */
  _cacheNegative(hostname) {
    const entry = new DNSCacheEntry(null, {
      isNegative: true,
      ttl: this.config.negativeCacheTTL,
      source: 'negative'
    });
    this.cache.set(hostname, entry);
  }

  /**
   * Trigger background revalidation
   */
  _revalidateInBackground(hostname) {
    // Use Promise without awaiting to run in background
    this._resolveWithFailover(hostname, { background: true })
      .then(result => {
        if (result.ip) {
          const entry = new DNSCacheEntry(result.ip, {
            resolver: result.resolver,
            source: 'revalidation'
          });
          this.cache.set(hostname, entry);
        }
      })
      .catch(() => {
        // Silent fail on background revalidation
      });
  }

  /**
   * Pre-warm DNS cache for known domains
   */
  async prewarm(additionalDomains = []) {
    const domains = [...new Set([...this.config.predictiveDomains, ...additionalDomains])];
    
    this.stats.predictiveResolutions += domains.length;
    
    const promises = domains.map(domain => 
      this.resolve(domain).catch(() => ({ ip: domain }))
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Predictive resolution based on access patterns
   */
  predictAndResolve(hostname) {
    // Check if this is a commonly accessed domain pattern
    const parts = hostname.split('.');
    
    if (parts.length >= 2) {
      const tld = parts.slice(-2).join('.');
      
      // If we've seen this TLD before, pre-resolve common subdomains
      for (const [cachedHost, entry] of this.cache) {
        if (cachedHost.endsWith(tld) && entry.accessCount > 3) {
          // This TLD is popular, pre-warm related domains
          const commonSubdomains = ['www', 'api', 'cdn', 'static'];
          for (const sub of commonSubdomains) {
            const predicted = `${sub}.${tld}`;
            if (!this.cache.has(predicted)) {
              // Don't await - just trigger
              this.resolve(predicted).catch(() => {});
            }
          }
          break;
        }
      }
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [hostname, entry] of this.cache) {
      if (entry.isExpired()) {
        this.cache.delete(hostname);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const cacheStats = {
      size: this.cache.size,
      positiveEntries: 0,
      negativeEntries: 0,
      staleEntries: 0
    };
    
    for (const entry of this.cache.values()) {
      if (entry.isNegative) cacheStats.negativeEntries++;
      else if (entry.isStale) cacheStats.staleEntries++;
      else cacheStats.positiveEntries++;
    }
    
    return {
      ...this.stats,
      cache: cacheStats,
      coalescer: this.coalescer.getStats(),
      hitRate: this.stats.hits + this.stats.misses > 0
        ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1) + '%'
        : '0%'
    };
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.cache.clear();
  }
}

// ============ ENHANCED MULTI-TIER CACHE ============

export class EnhancedCache {
  constructor(options = {}) {
    this.config = {
      l1MaxSize: options.l1MaxSize || 100,
      l1TTL: options.l1TTL || 300000,      // 5 minutes
      l2TTL: options.l2TTL || 3600000,     // 1 hour
      staleWhileRevalidate: options.staleWhileRevalidate !== false
    };
    
    // L1: In-memory cache
    this.l1 = new Map();
    
    // L2: KV namespace (optional)
    this.kv = options.kv || null;
    
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      staleHits: 0,
      writes: 0
    };
  }

  /**
   * Get from cache with stale-while-revalidate
   */
  async get(key, fetchFn, options = {}) {
    const now = Date.now();
    const ttl = options.ttl || this.config.l1TTL;
    
    // Check L1 cache
    const l1Entry = this.l1.get(key);
    
    if (l1Entry) {
      if (now - l1Entry.timestamp < ttl) {
        this.stats.l1Hits++;
        return l1Entry.data;
      }
      
      // Check if stale-while-revalidate applies
      const staleTime = l1Entry.timestamp + ttl + 60000; // 1 minute stale window
      if (now < staleTime && this.config.staleWhileRevalidate) {
        this.stats.staleHits++;
        
        // Trigger background refresh
        this._refreshInBackground(key, fetchFn, ttl);
        
        return l1Entry.data;
      }
    }
    
    this.stats.l1Misses++;
    
    // Check L2 (KV) cache
    if (this.kv) {
      try {
        const l2Data = await this.kv.get(key, 'json');
        if (l2Data) {
          this.stats.l2Hits++;
          
          // Promote to L1
          this.l1.set(key, { data: l2Data, timestamp: now });
          
          return l2Data;
        }
      } catch (e) {
        console.error('[Cache] L2 read error:', e);
      }
    }
    
    this.stats.l2Misses++;
    
    // Fetch fresh data
    const data = await fetchFn();
    
    // Store in cache
    await this.set(key, data, ttl);
    
    return data;
  }

  /**
   * Set cache value
   */
  async set(key, data, ttl = this.config.l1TTL) {
    const now = Date.now();
    
    // Store in L1
    this.l1.set(key, { data, timestamp: now });
    this.stats.writes++;
    
    // Evict if over size limit
    if (this.l1.size > this.config.l1MaxSize) {
      this._evictOldest();
    }
    
    // Store in L2 (KV)
    if (this.kv) {
      try {
        await this.kv.put(key, JSON.stringify(data), {
          expirationTtl: Math.floor(ttl / 1000)
        });
      } catch (e) {
        console.error('[Cache] L2 write error:', e);
      }
    }
  }

  /**
   * Delete from cache
   */
  async delete(key) {
    this.l1.delete(key);
    
    if (this.kv) {
      try {
        await this.kv.delete(key);
      } catch (e) {
        console.error('[Cache] L2 delete error:', e);
      }
    }
  }

  /**
   * Refresh in background
   */
  _refreshInBackground(key, fetchFn, ttl) {
    fetchFn()
      .then(data => this.set(key, data, ttl))
      .catch(() => {});
  }

  /**
   * Evict oldest entries
   */
  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.l1) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.l1.delete(oldestKey);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const totalMisses = this.stats.l1Misses + this.stats.l2Misses;
    
    return {
      l1Size: this.l1.size,
      hitRate: totalHits + totalMisses > 0
        ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(1) + '%'
        : '0%',
      ...this.stats
    };
  }

  /**
   * Clear cache
   */
  clear() {
    this.l1.clear();
  }
}

// ============ SINGLETON INSTANCES ============

export const enhancedDNSResolver = new EnhancedDNSResolver();

// ============ EXPORTS ============

export default {
  EnhancedDNSResolver,
  EnhancedCache,
  enhancedDNSResolver,
  DNS_CONFIG,
  DNSCacheEntry
};
