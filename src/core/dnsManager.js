/**
 * Enhanced DNS Manager with Fallback Resolvers
 * 
 * Features:
 * - Multiple DNS-over-HTTPS resolvers with automatic failover
 * - Stale-while-revalidate caching strategy
 * - Predictive DNS prefetching
 * - DNS-based load balancing
 */

import { dnsCache, dnsStats } from './state.js';
import { 
  DNS_CACHE_TTL, 
  DNS_RESOLVER,
  KNOWN_DOMAINS 
} from '../config/constants.js';

// DNS resolver configuration
const DNS_CONFIG = {
  // Primary and fallback resolvers
  resolvers: [
    { 
      name: 'cloudflare', 
      url: 'https://cloudflare-dns.com/dns-query',
      timeout: 5000,
      priority: 1
    },
    { 
      name: 'google', 
      url: 'https://dns.google/resolve',
      timeout: 5000,
      priority: 2
    },
    { 
      name: 'quad9', 
      url: 'https://dns.quad9.net:5053/dns-query',
      timeout: 5000,
      priority: 3
    }
  ],
  
  // Cache settings
  cacheTTL: DNS_CACHE_TTL,
  staleTTL: 300000,        // 5 minutes - serve stale while revalidating
  negativeTTL: 60000,      // 1 minute - cache negative responses
  
  // Prefetch settings
  prefetchThreshold: 0.8,  // Prefetch when 80% of TTL passed
  prefetchQueueMax: 20,    // Maximum concurrent prefetches
  
  // Retry settings
  maxRetries: 2,
  retryDelay: 1000,
  
  // Circuit breaker settings
  circuitFailureThreshold: 3,
  circuitRecoveryTime: 60000
};

/**
 * DNS Resolver Health Tracker
 */
class ResolverHealthTracker {
  constructor() {
    this.resolvers = new Map();
  }
  
  /**
   * Get health status for resolver
   */
  getHealth(name) {
    if (!this.resolvers.has(name)) {
      this.resolvers.set(name, {
        totalQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        lastSuccess: null,
        lastFailure: null,
        avgLatency: 0,
        isHealthy: true,
        circuitOpen: false,
        circuitOpenTime: null,
        consecutiveFailures: 0
      });
    }
    return this.resolvers.get(name);
  }
  
  /**
   * Record successful query
   */
  recordSuccess(name, latency) {
    const health = this.getHealth(name);
    health.totalQueries++;
    health.successfulQueries++;
    health.lastSuccess = Date.now();
    health.consecutiveFailures = 0;
    
    // Update average latency
    health.avgLatency = (health.avgLatency * (health.successfulQueries - 1) + latency) / health.successfulQueries;
    
    // Reset circuit if it was open
    if (health.circuitOpen) {
      health.circuitOpen = false;
      health.circuitOpenTime = null;
    }
  }
  
  /**
   * Record failed query
   */
  recordFailure(name) {
    const health = this.getHealth(name);
    health.totalQueries++;
    health.failedQueries++;
    health.lastFailure = Date.now();
    health.consecutiveFailures++;
    
    // Open circuit if threshold reached
    if (health.consecutiveFailures >= DNS_CONFIG.circuitFailureThreshold) {
      health.circuitOpen = true;
      health.circuitOpenTime = Date.now();
      health.isHealthy = false;
    }
  }
  
  /**
   * Check if resolver is available
   */
  isAvailable(name) {
    const health = this.getHealth(name);
    
    // Check if circuit is open
    if (health.circuitOpen) {
      // Check if recovery time has passed
      if (Date.now() - health.circuitOpenTime > DNS_CONFIG.circuitRecoveryTime) {
        health.circuitOpen = false;
        health.consecutiveFailures = 0;
        return true;
      }
      return false;
    }
    
    return health.isHealthy;
  }
  
  /**
   * Get best resolver based on health and latency
   */
  getBestResolver() {
    const available = DNS_CONFIG.resolvers.filter(r => this.isAvailable(r.name));
    
    if (available.length === 0) {
      // All resolvers are down, try primary anyway
      return DNS_CONFIG.resolvers[0];
    }
    
    // Sort by priority and latency
    available.sort((a, b) => {
      const healthA = this.getHealth(a.name);
      const healthB = this.getHealth(b.name);
      
      // Lower latency wins
      if (healthA.avgLatency && healthB.avgLatency) {
        return healthA.avgLatency - healthB.avgLatency;
      }
      
      // Fall back to priority
      return a.priority - b.priority;
    });
    
    return available[0];
  }
  
  /**
   * Get all resolver statuses
   */
  getAllStatus() {
    const statuses = {};
    for (const resolver of DNS_CONFIG.resolvers) {
      const health = this.getHealth(resolver.name);
      statuses[resolver.name] = {
        ...health,
        url: resolver.url,
        priority: resolver.priority
      };
    }
    return statuses;
  }
}

/**
 * Stale-While-Revalidate Cache
 */
class SWRCache {
  constructor() {
    this.cache = dnsCache;
    this.pendingRefreshes = new Map();
    this.stats = {
      hits: 0,
      staleHits: 0,
      misses: 0,
      refreshes: 0,
      prefetchHits: 0
    };
  }
  
  /**
   * Get from cache with stale-while-revalidate support
   */
  get(hostname) {
    if (!this.cache.has(hostname)) {
      this.stats.misses++;
      return { hit: false, value: null, stale: false };
    }
    
    const entry = this.cache.get(hostname);
    const now = Date.now();
    const age = now - entry.timestamp;
    
    // Fresh cache
    if (age < DNS_CONFIG.cacheTTL) {
      this.stats.hits++;
      
      // Check if we should prefetch
      if (age > DNS_CONFIG.cacheTTL * DNS_CONFIG.prefetchThreshold) {
        this.schedulePrefetch(hostname);
      }
      
      return { hit: true, value: entry.ip, stale: false, ttl: DNS_CONFIG.cacheTTL - age };
    }
    
    // Stale but usable
    if (age < DNS_CONFIG.cacheTTL + DNS_CONFIG.staleTTL) {
      this.stats.staleHits++;
      
      // Trigger background refresh
      this.scheduleRefresh(hostname);
      
      return { hit: true, value: entry.ip, stale: true, ttl: 0 };
    }
    
    // Too old
    this.stats.misses++;
    this.cache.delete(hostname);
    return { hit: false, value: null, stale: false };
  }
  
  /**
   * Set cache entry
   */
  set(hostname, ip, options = {}) {
    this.cache.set(hostname, {
      ip,
      timestamp: Date.now(),
      source: options.source || 'resolve',
      ttl: options.ttl || DNS_CONFIG.cacheTTL
    });
  }
  
  /**
   * Schedule background refresh
   */
  scheduleRefresh(hostname) {
    if (this.pendingRefreshes.has(hostname)) return;
    
    this.pendingRefreshes.set(hostname, true);
    this.stats.refreshes++;
    
    // Return a promise that will be resolved by the caller
    return hostname;
  }
  
  /**
   * Schedule prefetch for soon-to-expire entry
   */
  schedulePrefetch(hostname) {
    if (this.pendingRefreshes.has(hostname)) return;
    
    this.pendingRefreshes.set(hostname, true);
    this.stats.prefetchHits++;
  }
  
  /**
   * Mark refresh as complete
   */
  completeRefresh(hostname) {
    this.pendingRefreshes.delete(hostname);
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      pendingRefreshes: this.pendingRefreshes.size,
      hitRate: this.stats.hits + this.stats.staleHits + this.stats.misses > 0
        ? ((this.stats.hits + this.stats.staleHits) / (this.stats.hits + this.stats.staleHits + this.stats.misses) * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

/**
 * Predictive DNS Prefetcher
 */
class DNSPrefetcher {
  constructor() {
    this.accessPatterns = new Map(); // hostname -> access pattern
    this.prefetchQueue = [];
    this.isProcessing = false;
    this.stats = {
      predictions: 0,
      successfulPrefetches: 0,
      failedPrefetches: 0,
      patternsLearned: 0
    };
  }
  
  /**
   * Record domain access for pattern learning
   */
  recordAccess(hostname) {
    if (!this.accessPatterns.has(hostname)) {
      this.accessPatterns.set(hostname, {
        accesses: [],
        avgInterval: 0,
        nextPredicted: null,
        prefetched: false
      });
    }
    
    const pattern = this.accessPatterns.get(hostname);
    const now = Date.now();
    pattern.accesses.push(now);
    
    // Keep last 10 accesses
    if (pattern.accesses.length > 10) {
      pattern.accesses.shift();
    }
    
    // Calculate average interval
    if (pattern.accesses.length >= 2) {
      let totalInterval = 0;
      for (let i = 1; i < pattern.accesses.length; i++) {
        totalInterval += pattern.accesses[i] - pattern.accesses[i - 1];
      }
      pattern.avgInterval = totalInterval / (pattern.accesses.length - 1);
      
      // Predict next access
      pattern.nextPredicted = now + pattern.avgInterval;
      this.stats.patternsLearned++;
    }
  }
  
  /**
   * Get domains that should be prefetched
   */
  getDomainsToPrefetch() {
    const now = Date.now();
    const prefetchWindow = 30000; // 30 seconds ahead
    
    const toPrefetch = [];
    
    for (const [hostname, pattern] of this.accessPatterns) {
      if (pattern.nextPredicted && 
          pattern.nextPredicted > now && 
          pattern.nextPredicted < now + prefetchWindow &&
          !pattern.prefetched) {
        toPrefetch.push(hostname);
        pattern.prefetched = true;
      }
    }
    
    return toPrefetch;
  }
  
  /**
   * Add to prefetch queue
   */
  queuePrefetch(hostname, resolveFn) {
    this.prefetchQueue.push({ hostname, resolveFn, timestamp: Date.now() });
    this.stats.predictions++;
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  
  /**
   * Process prefetch queue
   */
  async processQueue() {
    if (this.prefetchQueue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    
    while (this.prefetchQueue.length > 0) {
      if (this.prefetchQueue.length > DNS_CONFIG.prefetchQueueMax) {
        // Remove oldest entries
        this.prefetchQueue = this.prefetchQueue.slice(-DNS_CONFIG.prefetchQueueMax);
      }
      
      const item = this.prefetchQueue.shift();
      
      try {
        await item.resolveFn(item.hostname);
        this.stats.successfulPrefetches++;
      } catch (e) {
        this.stats.failedPrefetches++;
      }
      
      // Small delay between prefetches
      await new Promise(r => setTimeout(r, 100));
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Get prefetcher statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.prefetchQueue.length,
      patternsTracked: this.accessPatterns.size
    };
  }
}

/**
 * Enhanced DNS Manager
 */
class DNSManager {
  constructor() {
    this.healthTracker = new ResolverHealthTracker();
    this.cache = new SWRCache();
    this.prefetcher = new DNSPrefetcher();
    
    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      fallbackUsed: 0
    };
  }
  
  /**
   * Resolve hostname with fallback support
   */
  async resolve(hostname, options = {}) {
    this.stats.totalQueries++;
    
    // Record access for predictive prefetching
    if (options.learnPattern !== false) {
      this.prefetcher.recordAccess(hostname);
    }
    
    // Check cache first
    const cached = this.cache.get(hostname);
    if (cached.hit) {
      dnsStats.hits++;
      return cached.ip;
    }
    
    dnsStats.misses++;
    
    // Resolve with fallback
    try {
      const ip = await this.resolveWithFallback(hostname);
      this.stats.successfulQueries++;
      return ip;
    } catch (error) {
      this.stats.failedQueries++;
      
      // Return stale cache if available as last resort
      if (cached.value) {
        console.warn(`DNS resolution failed for ${hostname}, using stale cache`);
        return cached.value;
      }
      
      // Return hostname as fallback
      dnsStats.fallback++;
      return hostname;
    }
  }
  
  /**
   * Resolve using multiple resolvers with fallback
   */
  async resolveWithFallback(hostname) {
    const resolvers = [...DNS_CONFIG.resolvers].sort((a, b) => {
      // Prioritize healthy resolvers
      const healthA = this.healthTracker.isAvailable(a.name);
      const healthB = this.healthTracker.isAvailable(b.name);
      if (healthA && !healthB) return -1;
      if (!healthA && healthB) return 1;
      return a.priority - b.priority;
    });
    
    let lastError = null;
    
    for (let i = 0; i < resolvers.length; i++) {
      const resolver = resolvers[i];
      
      if (!this.healthTracker.isAvailable(resolver.name)) {
        continue;
      }
      
      try {
        const startTime = Date.now();
        const result = await this.queryResolver(resolver, hostname);
        const latency = Date.now() - startTime;
        
        // Record success
        this.healthTracker.recordSuccess(resolver.name, latency);
        
        // Cache result
        this.cache.set(hostname, result.ip, { source: resolver.name });
        dnsStats.dohSuccess++;
        
        // Clear pending refresh
        this.cache.completeRefresh(hostname);
        
        if (i > 0) {
          this.stats.fallbackUsed++;
        }
        
        return result.ip;
      } catch (error) {
        this.healthTracker.recordFailure(resolver.name);
        lastError = error;
        
        console.warn(`DNS resolver ${resolver.name} failed for ${hostname}:`, error.message);
      }
    }
    
    dnsStats.dohFail++;
    throw lastError || new Error('All DNS resolvers failed');
  }
  
  /**
   * Query a specific resolver
   */
  async queryResolver(resolver, hostname) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), resolver.timeout);
    
    try {
      let url;
      const headers = {};
      
      if (resolver.name === 'google') {
        url = `${resolver.url}?name=${hostname}&type=A`;
        headers['Accept'] = 'application/dns-json';
      } else {
        url = `${resolver.url}?name=${hostname}&type=A`;
        headers['Accept'] = 'application/dns-json';
      }
      
      const response = await fetch(url, {
        headers,
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
      
      // Find A record
      if (data.Answer && data.Answer.length > 0) {
        const aRecord = data.Answer.find(r => r.type === 1 || r.type === 'A');
        if (aRecord && aRecord.data) {
          return { ip: aRecord.data, ttl: aRecord.TTL || 600 };
        }
      }
      
      // No A record found
      throw new Error('No A record found');
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  /**
   * Prefetch known domains
   */
  async prefetchKnownDomains() {
    const domains = [...KNOWN_DOMAINS];
    
    // Add predicted domains
    const predicted = this.prefetcher.getDomainsToPrefetch();
    domains.push(...predicted);
    
    const results = [];
    
    for (const domain of domains) {
      try {
        await this.resolve(domain, { learnPattern: false });
        results.push({ domain, success: true });
      } catch (e) {
        results.push({ domain, success: false, error: e.message });
      }
    }
    
    return results;
  }
  
  /**
   * Check if cached entry needs refresh
   */
  needsRefresh(hostname) {
    const pending = this.cache.pendingRefreshes.has(hostname);
    return this.cache.scheduleRefresh(hostname) && !pending;
  }
  
  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      queries: this.stats,
      resolvers: this.healthTracker.getAllStatus(),
      cache: this.cache.getStats(),
      prefetcher: this.prefetcher.getStats(),
      dnsStats: {
        hits: dnsStats.hits,
        misses: dnsStats.misses,
        dohSuccess: dnsStats.dohSuccess,
        dohFail: dnsStats.dohFail,
        fallback: dnsStats.fallback
      }
    };
  }
  
  /**
   * Perform cleanup
   */
  cleanup() {
    // Clear old cache entries
    const now = Date.now();
    const maxAge = DNS_CONFIG.cacheTTL + DNS_CONFIG.staleTTL;
    
    for (const [hostname, entry] of dnsCache) {
      if (now - entry.timestamp > maxAge) {
        dnsCache.delete(hostname);
      }
    }
    
    // Reset circuit breakers if needed
    for (const resolver of DNS_CONFIG.resolvers) {
      const health = this.healthTracker.getHealth(resolver.name);
      if (health.circuitOpen && 
          now - health.circuitOpenTime > DNS_CONFIG.circuitRecoveryTime * 2) {
        health.circuitOpen = false;
        health.consecutiveFailures = 0;
      }
    }
  }
}

// Global instance
export const dnsManager = new DNSManager();

// Export convenience function
export async function resolveDNS(hostname) {
  return dnsManager.resolve(hostname);
}

export default {
  DNSManager,
  ResolverHealthTracker,
  SWRCache,
  DNSPrefetcher,
  dnsManager,
  resolveDNS,
  DNS_CONFIG
};
