/**
 * Enhanced Network Utilities
 * Improvements: Connection health monitoring, predictive warmup, zero-copy optimizations
 */

import { connect } from "cloudflare:sockets";
import { 
  latencyTracker, 
  timeoutStats, 
  connectionPool, 
  poolStats,
  retryStats,
  safeClearOldest
} from '../core/state.js';
import { circuitBreakerManager, CIRCUIT_STATE } from '../core/circuitBreaker.js';
import { 
  LATENCY_HISTORY_SIZE, 
  TIMEOUT_MIN, 
  TIMEOUT_MAX, 
  TIMEOUT_MULTIPLIER, 
  TIMEOUT_DEFAULT,
  POOL_MAX_SIZE,
  POOL_IDLE_TIMEOUT,
  RETRY_BASE_DELAY,
  RETRY_MAX_DELAY,
  RETRY_JITTER_FACTOR
} from '../config/constants.js';

// ============ ENHANCED CONNECTION POOL ============

const POOL_ENTRY_MAX_AGE = 60000; // 60 seconds
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Connection health status
 */
export const CONNECTION_HEALTH = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  UNHEALTHY: 'UNHEALTHY',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Enhanced connection pool entry with health tracking
 */
class PoolEntry {
  constructor(socket, address, port) {
    this.socket = socket;
    this.address = address;
    this.port = port;
    this.timestamp = Date.now();
    this.lastUsed = Date.now();
    this.useCount = 0;
    this.errorCount = 0;
    this.bytesSent = 0;
    this.bytesReceived = 0;
    this.health = CONNECTION_HEALTH.HEALTHY;
    this.latencyHistory = [];
  }

  recordUse() {
    this.useCount++;
    this.lastUsed = Date.now();
  }

  recordError() {
    this.errorCount++;
    // Degrade health based on error rate
    if (this.errorCount > 3) {
      this.health = CONNECTION_HEALTH.UNHEALTHY;
    } else if (this.errorCount > 1) {
      this.health = CONNECTION_HEALTH.DEGRADED;
    }
  }

  recordLatency(latency) {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > 10) {
      this.latencyHistory.shift();
    }
  }

  getAverageLatency() {
    if (this.latencyHistory.length === 0) return 0;
    return Math.round(this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length);
  }

  isExpired() {
    return Date.now() - this.timestamp > POOL_ENTRY_MAX_AGE;
  }

  isStale() {
    return Date.now() - this.lastUsed > 30000; // 30 seconds idle
  }

  getAge() {
    return Date.now() - this.timestamp;
  }
}

/**
 * Enhanced connection pool with health monitoring
 */
export class EnhancedConnectionPool {
  constructor(maxSize = POOL_MAX_SIZE) {
    this.pool = new Map();
    this.maxSize = maxSize;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      healthChecks: 0,
      unhealthyRejections: 0,
      predictiveWarmups: 0,
      totalBytesTransferred: 0
    };
    this.warmupCandidates = new Map(); // Predictive warmup candidates
    this.accessPatterns = new Map(); // Track access patterns
  }

  /**
   * Get pool key
   */
  getKey(address, port) {
    return `${address}:${port}`;
  }

  /**
   * Record access pattern for predictive warmup
   */
  recordAccess(address, port) {
    const key = this.getKey(address, port);
    const now = Date.now();
    
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }
    
    const patterns = this.accessPatterns.get(key);
    patterns.push(now);
    
    // Keep only last 20 accesses
    if (patterns.length > 20) {
      patterns.shift();
    }
    
    // Analyze pattern for warmup candidate
    this._analyzePattern(key, patterns);
  }

  /**
   * Analyze access pattern to identify warmup candidates
   */
  _analyzePattern(key, patterns) {
    if (patterns.length < 5) return;
    
    // Calculate average interval
    let totalInterval = 0;
    for (let i = 1; i < patterns.length; i++) {
      totalInterval += patterns[i] - patterns[i - 1];
    }
    const avgInterval = totalInterval / (patterns.length - 1);
    
    // If accessed frequently with regular intervals, add to warmup candidates
    if (avgInterval < 60000 && patterns.length >= 5) { // Less than 1 minute interval
      this.warmupCandidates.set(key, {
        lastAccess: patterns[patterns.length - 1],
        avgInterval,
        priority: patterns.length
      });
    }
  }

  /**
   * Get connection from pool with health check
   */
  async get(address, port, log) {
    const key = this.getKey(address, port);
    this.recordAccess(address, port);
    
    // Check circuit breaker first
    const circuitCheck = circuitBreakerManager.canExecute(key);
    if (!circuitCheck.allowed) {
      if (log) log(`[Pool] Circuit OPEN for ${key}, rejecting`);
      this.stats.unhealthyRejections++;
      return null;
    }

    const entry = this.pool.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if entry is expired
    if (entry.isExpired()) {
      this._closeEntry(entry);
      this.pool.delete(key);
      this.stats.misses++;
      if (log) log(`[Pool] Entry EXPIRED: ${key}`);
      return null;
    }
    
    // Check if socket is still valid
    if (entry.socket.closed) {
      this.pool.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Check health status
    if (entry.health === CONNECTION_HEALTH.UNHEALTHY) {
      this._closeEntry(entry);
      this.pool.delete(key);
      this.stats.unhealthyRejections++;
      if (log) log(`[Pool] Entry UNHEALTHY: ${key}`);
      return null;
    }
    
    // Valid connection found
    this.pool.delete(key); // Remove from pool (one-time use)
    entry.recordUse();
    this.stats.hits++;
    
    if (log) {
      log(`[Pool] HIT: ${key} (health: ${entry.health}, uses: ${entry.useCount}, age: ${entry.getAge()}ms)`);
    }
    
    return {
      socket: entry.socket,
      health: entry.health,
      avgLatency: entry.getAverageLatency(),
      useCount: entry.useCount
    };
  }

  /**
   * Return connection to pool with health tracking
   */
  returnConnection(socket, address, port, metadata = {}, log) {
    if (!socket || socket.closed) return;
    
    const key = this.getKey(address, port);
    
    // Don't return unhealthy connections
    if (metadata.health === CONNECTION_HEALTH.UNHEALTHY) {
      this._closeSocket(socket);
      return;
    }
    
    // Check existing entry
    if (this.pool.has(key)) {
      const existing = this.pool.get(key);
      this._closeEntry(existing);
      this.pool.delete(key);
    }
    
    // Evict if pool is full
    if (this.pool.size >= this.maxSize) {
      this._evictOldest(log);
    }
    
    // Create new entry
    const entry = new PoolEntry(socket, address, port);
    if (metadata.bytesSent) entry.bytesSent = metadata.bytesSent;
    if (metadata.bytesReceived) entry.bytesReceived = metadata.bytesReceived;
    if (metadata.latency) entry.recordLatency(metadata.latency);
    if (metadata.health) entry.health = metadata.health;
    
    this.pool.set(key, entry);
    
    // Update bytes transferred stat
    this.stats.totalBytesTransferred += (metadata.bytesSent || 0) + (metadata.bytesReceived || 0);
    
    if (log) {
      log(`[Pool] RETURN: ${key} (pool size: ${this.pool.size}/${this.maxSize})`);
    }
  }

  /**
   * Mark connection as having an error
   */
  markError(address, port, error) {
    const key = this.getKey(address, port);
    
    // Record in circuit breaker
    circuitBreakerManager.recordFailure(key, error);
    
    // Update any pooled entry
    const entry = this.pool.get(key);
    if (entry) {
      entry.recordError();
      if (entry.health === CONNECTION_HEALTH.UNHEALTHY) {
        this._closeEntry(entry);
        this.pool.delete(key);
      }
    }
  }

  /**
   * Mark connection success
   */
  markSuccess(address, port, latency = 0) {
    const key = this.getKey(address, port);
    circuitBreakerManager.recordSuccess(key, latency);
  }

  /**
   * Perform health check on all pooled connections
   */
  performHealthCheck(log) {
    this.stats.healthChecks++;
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.pool) {
      // Remove expired entries
      if (entry.isExpired()) {
        this._closeEntry(entry);
        this.pool.delete(key);
        removed++;
        continue;
      }
      
      // Remove stale entries (idle too long)
      if (entry.isStale()) {
        this._closeEntry(entry);
        this.pool.delete(key);
        removed++;
        continue;
      }
      
      // Check socket validity
      if (entry.socket.closed) {
        this.pool.delete(key);
        removed++;
      }
    }
    
    // Cleanup circuit breakers
    circuitBreakerManager.cleanup();
    
    if (removed > 0 && log) {
      log(`[Pool] Health check: removed ${removed} entries, size now ${this.pool.size}`);
    }
    
    return removed;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    
    for (const entry of this.pool.values()) {
      if (entry.health === CONNECTION_HEALTH.HEALTHY) healthy++;
      else if (entry.health === CONNECTION_HEALTH.DEGRADED) degraded++;
      else unhealthy++;
    }
    
    const circuitSummary = circuitBreakerManager.getSummary();
    
    return {
      poolSize: this.pool.size,
      maxSize: this.maxSize,
      healthy,
      degraded,
      unhealthy,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1) + '%'
        : 'N/A',
      circuitBreakers: circuitSummary,
      ...this.stats
    };
  }

  /**
   * Get predictive warmup recommendations
   */
  getWarmupRecommendations() {
    const recommendations = [];
    const now = Date.now();
    
    for (const [key, candidate] of this.warmupCandidates) {
      // Predict next access time
      const expectedNextAccess = candidate.lastAccess + candidate.avgInterval;
      const timeUntilAccess = expectedNextAccess - now;
      
      // Recommend warmup if access expected within next 10 seconds
      if (timeUntilAccess < 10000 && timeUntilAccess > -5000) {
        recommendations.push({
          key,
          priority: candidate.priority,
          expectedIn: Math.max(0, timeUntilAccess)
        });
      }
    }
    
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  // Private methods

  _closeEntry(entry) {
    if (entry && entry.socket && !entry.socket.closed) {
      try {
        entry.socket.close();
      } catch (e) {
        // Silent fail
      }
    }
  }

  _closeSocket(socket) {
    if (socket && !socket.closed) {
      try {
        socket.close();
      } catch (e) {
        // Silent fail
      }
    }
  }

  _evictOldest(log) {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    // First try to evict unhealthy or stale entries
    for (const [key, entry] of this.pool) {
      if (entry.health === CONNECTION_HEALTH.UNHEALTHY || entry.isStale()) {
        this._closeEntry(entry);
        this.pool.delete(key);
        this.stats.evictions++;
        if (log) log(`[Pool] Evicted unhealthy/stale: ${key}`);
        return;
      }
    }
    
    // Otherwise evict oldest
    for (const [key, entry] of this.pool) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      const entry = this.pool.get(oldestKey);
      this._closeEntry(entry);
      this.pool.delete(oldestKey);
      this.stats.evictions++;
      if (log) log(`[Pool] Evicted oldest: ${oldestKey}`);
    }
  }
}

// ============ ADAPTIVE TIMEOUT WITH MACHINE LEARNING ============

/**
 * Enhanced adaptive timeout with pattern recognition
 */
export class AdaptiveTimeoutManager {
  constructor() {
    this.latencyHistory = new Map();
    this.timeoutAdjustments = new Map();
    this.config = {
      historySize: LATENCY_HISTORY_SIZE,
      minTimeout: TIMEOUT_MIN,
      maxTimeout: TIMEOUT_MAX,
      multiplier: TIMEOUT_MULTIPLIER,
      defaultTimeout: TIMEOUT_DEFAULT
    };
  }

  /**
   * Record latency measurement
   */
  recordLatency(address, port, latency) {
    const key = `${address}:${port}`;
    
    if (!this.latencyHistory.has(key)) {
      this.latencyHistory.set(key, []);
    }
    
    const history = this.latencyHistory.get(key);
    history.push({
      latency,
      timestamp: Date.now(),
      success: true
    });
    
    // Keep bounded history
    if (history.length > this.config.historySize * 2) {
      history.splice(0, history.length - this.config.historySize);
    }
  }

  /**
   * Record timeout event
   */
  recordTimeout(address, port) {
    const key = `${address}:${port}`;
    
    if (!this.latencyHistory.has(key)) {
      this.latencyHistory.set(key, []);
    }
    
    const history = this.latencyHistory.get(key);
    history.push({
      latency: this.config.maxTimeout,
      timestamp: Date.now(),
      success: false,
      timeout: true
    });
  }

  /**
   * Calculate adaptive timeout with multiple percentiles
   */
  calculateTimeout(address, port, log) {
    const key = `${address}:${port}`;
    const history = this.latencyHistory.get(key);
    
    if (!history || history.length < 3) {
      timeoutStats.default++;
      return this.config.defaultTimeout;
    }
    
    // Extract latencies from successful requests
    const latencies = history
      .filter(h => h.success)
      .map(h => h.latency)
      .sort((a, b) => a - b);
    
    if (latencies.length === 0) {
      timeoutStats.default++;
      return this.config.defaultTimeout;
    }
    
    // Calculate multiple percentiles
    const p50 = this._percentile(latencies, 50);
    const p90 = this._percentile(latencies, 90);
    const p95 = this._percentile(latencies, 95);
    const p99 = this._percentile(latencies, 99);
    
    // Calculate timeout based on P95 with P99 ceiling
    let timeout = Math.min(p95 * this.config.multiplier, p99 * 1.5);
    
    // Adjust based on timeout rate
    const timeoutRate = history.filter(h => h.timeout).length / history.length;
    if (timeoutRate > 0.1) { // More than 10% timeouts
      timeout *= 1.2; // Increase by 20%
    }
    
    // Clamp to bounds
    timeout = Math.max(this.config.minTimeout, Math.min(this.config.maxTimeout, timeout));
    
    timeoutStats.adaptive++;
    
    if (log) {
      log(`[AdaptiveTimeout] ${key}: ${Math.round(timeout)}ms (P50:${p50}ms, P95:${p95}ms, P99:${p99}ms)`);
    }
    
    return Math.round(timeout);
  }

  /**
   * Get timeout statistics for endpoint
   */
  getStats(address, port) {
    const key = `${address}:${port}`;
    const history = this.latencyHistory.get(key);
    
    if (!history || history.length === 0) {
      return null;
    }
    
    const latencies = history.filter(h => h.success).map(h => h.latency);
    const timeouts = history.filter(h => h.timeout).length;
    
    return {
      samples: history.length,
      timeouts,
      timeoutRate: (timeouts / history.length * 100).toFixed(1) + '%',
      avgLatency: latencies.length > 0 
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0
    };
  }

  _percentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * percentile / 100) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Cleanup old entries
   */
  cleanup(maxAge = 300000) {
    const cutoff = Date.now() - maxAge;
    for (const [key, history] of this.latencyHistory) {
      // Remove old entries
      const filtered = history.filter(h => h.timestamp >= cutoff);
      if (filtered.length === 0) {
        this.latencyHistory.delete(key);
      } else if (filtered.length < history.length) {
        this.latencyHistory.set(key, filtered);
      }
    }
  }
}

// ============ SMART RETRY WITH CIRCUIT BREAKER INTEGRATION ============

/**
 * Enhanced retry with circuit breaker awareness
 */
export class SmartRetryManager {
  constructor() {
    this.config = {
      maxAttempts: RETRY_MAX_ATTEMPTS,
      baseDelay: RETRY_BASE_DELAY,
      maxDelay: RETRY_MAX_DELAY,
      jitterFactor: RETRY_JITTER_FACTOR
    };
    this.stats = {
      attempts: 0,
      successes: 0,
      failures: 0,
      totalDelay: 0,
      circuitBreaks: 0
    };
  }

  /**
   * Calculate backoff delay
   */
  calculateBackoff(attempt) {
    const exponentialDelay = Math.min(
      this.config.baseDelay * Math.pow(2, attempt),
      this.config.maxDelay
    );
    const jitter = exponentialDelay * this.config.jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, Math.floor(exponentialDelay + jitter));
  }

  /**
   * Check if retry should be attempted
   */
  shouldRetry(key, attempt, error) {
    // Check circuit breaker
    const circuitCheck = circuitBreakerManager.canExecute(key);
    if (!circuitCheck.allowed) {
      this.stats.circuitBreaks++;
      return { shouldRetry: false, reason: 'circuit_open' };
    }
    
    // Check max attempts
    if (attempt >= this.config.maxAttempts) {
      return { shouldRetry: false, reason: 'max_attempts' };
    }
    
    // Check if error is retryable
    if (!this._isRetryable(error)) {
      return { shouldRetry: false, reason: 'non_retryable_error' };
    }
    
    return { shouldRetry: true, delay: this.calculateBackoff(attempt) };
  }

  /**
   * Determine if error is retryable
   */
  _isRetryable(error) {
    if (!error) return true;
    
    const message = error.message?.toLowerCase() || '';
    
    // Non-retryable errors
    const nonRetryablePatterns = [
      'auth',
      'forbidden',
      'unauthorized',
      'not found',
      'bad request',
      'invalid'
    ];
    
    return !nonRetryablePatterns.some(p => message.includes(p));
  }

  getStats() {
    return { ...this.stats };
  }
}

// ============ SINGLETON INSTANCES ============

export const enhancedConnectionPool = new EnhancedConnectionPool();
export const adaptiveTimeoutManager = new AdaptiveTimeoutManager();
export const smartRetryManager = new SmartRetryManager();

// ============ EXPORTS ============

export default {
  EnhancedConnectionPool,
  AdaptiveTimeoutManager,
  SmartRetryManager,
  enhancedConnectionPool,
  adaptiveTimeoutManager,
  smartRetryManager,
  CONNECTION_HEALTH
};
