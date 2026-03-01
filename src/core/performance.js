/**
 * Performance & Throughput Module
 * Provides request optimization, compression, and throughput enhancement
 * 
 * @module core/performance
 * @version 2.0.0
 */

// ============ REQUEST PIPELINING ============

/**
 * Request pipeline for batching and parallel execution
 */
export class RequestPipeline {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 10;
    this.batchSize = options.batchSize ?? 5;
    this.batchTimeout = options.batchTimeout ?? 50; // ms
    this.retryAttempts = options.retryAttempts ?? 3;
    this.retryDelay = options.retryDelay ?? 100;
    this.timeout = options.timeout ?? 30000;
    
    this.queue = [];
    this.activeRequests = 0;
    this.batchTimer = null;
    this.stats = {
      total: 0,
      batched: 0,
      parallel: 0,
      failed: 0,
      avgLatency: 0,
      totalLatency: 0
    };
  }

  /**
   * Add a request to the pipeline
   * @param {Function} requestFn - Async function to execute
   * @param {Object} options - Request options
   * @returns {Promise} Request result
   */
  async add(requestFn, options = {}) {
    return new Promise((resolve, reject) => {
      const item = {
        fn: requestFn,
        options,
        resolve,
        reject,
        addedAt: Date.now()
      };

      this.queue.push(item);
      this.stats.total++;

      this.processQueue();
    });
  }

  async processQueue() {
    // Don't exceed concurrent limit
    if (this.activeRequests >= this.maxConcurrent) return;
    if (this.queue.length === 0) return;

    // Check if we should batch
    if (this.queue.length >= this.batchSize) {
      this.processBatch();
    } else {
      // Wait for more items or timeout
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.batchTimer = null;
          this.processQueue();
        }, this.batchTimeout);
      }
    }

    // Process single items if we have capacity
    while (this.activeRequests < this.maxConcurrent && this.queue.length > 0) {
      const item = this.queue.shift();
      this.executeSingle(item);
    }
  }

  async processBatch() {
    const batch = this.queue.splice(0, this.batchSize);
    if (batch.length === 0) return;

    this.activeRequests++;
    this.stats.batched++;

    const startTime = Date.now();

    try {
      const results = await Promise.allSettled(
        batch.map(item => this.executeWithRetry(item.fn, item.options))
      );

      batch.forEach((item, i) => {
        const result = results[i];
        if (result.status === 'fulfilled') {
          item.resolve(result.value);
        } else {
          this.stats.failed++;
          item.reject(result.reason);
        }
      });

      const latency = Date.now() - startTime;
      this.updateLatencyStats(latency);
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  async executeSingle(item) {
    this.activeRequests++;
    this.stats.parallel++;

    const startTime = Date.now();

    try {
      const result = await this.executeWithRetry(item.fn, item.options);
      item.resolve(result);

      const latency = Date.now() - startTime;
      this.updateLatencyStats(latency);
    } catch (error) {
      this.stats.failed++;
      item.reject(error);
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  async executeWithRetry(fn, options, attempt = 0) {
    const timeout = options.timeout ?? this.timeout;
    const maxRetries = options.retryAttempts ?? this.retryAttempts;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const result = await fn(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      if (attempt < maxRetries && this.isRetryable(error)) {
        await this.delay(this.retryDelay * Math.pow(2, attempt));
        return this.executeWithRetry(fn, options, attempt + 1);
      }
      throw error;
    }
  }

  isRetryable(error) {
    // Don't retry on client errors (4xx)
    if (error.status >= 400 && error.status < 500) return false;
    // Retry on network errors, timeouts, and server errors
    return true;
  }

  updateLatencyStats(latency) {
    this.stats.totalLatency += latency;
    this.stats.avgLatency = this.stats.totalLatency / 
      (this.stats.batched + this.stats.parallel);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get pipeline statistics
   * @returns {Object} Pipeline stats
   */
  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      activeRequests: this.activeRequests
    };
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }
}

// ============ COMPRESSION ============

/**
 * Compression utilities
 */
export class CompressionManager {
  constructor(options = {}) {
    this.minSize = options.minSize ?? 1024; // Only compress if > 1KB
    this.level = options.level ?? 6; // Compression level (1-9)
    this.enabledTypes = new Set(options.enabledTypes ?? [
      'text/html',
      'text/css',
      'text/javascript',
      'application/javascript',
      'application/json',
      'application/xml',
      'text/xml',
      'text/plain',
      'application/x-javascript'
    ]);
    this.stats = {
      compressed: 0,
      skipped: 0,
      bytesIn: 0,
      bytesOut: 0
    };
  }

  /**
   * Check if content type should be compressed
   * @param {string} contentType - Content type header
   * @returns {boolean} Should compress
   */
  shouldCompress(contentType) {
    if (!contentType) return false;
    const baseType = contentType.split(';')[0].trim().toLowerCase();
    return this.enabledTypes.has(baseType);
  }

  /**
   * Check if client accepts compression
   * @param {string} acceptEncoding - Accept-Encoding header
   * @returns {string|null} Preferred encoding
   */
  getPreferredEncoding(acceptEncoding) {
    if (!acceptEncoding) return null;

    const encodings = acceptEncoding.toLowerCase().split(',').map(e => e.trim());
    
    // Prefer brotli over gzip
    if (encodings.some(e => e.startsWith('br'))) return 'br';
    if (encodings.some(e => e.startsWith('gzip'))) return 'gzip';
    
    return null;
  }

  /**
   * Compress response if appropriate
   * @param {Response} response - Response to compress
   * @param {Request} request - Original request
   * @returns {Response} Potentially compressed response
   */
  async compressResponse(response, request) {
    // Check if compression is supported
    if (typeof CompressionStream === 'undefined') {
      return response;
    }

    const acceptEncoding = request.headers.get('accept-encoding');
    const encoding = this.getPreferredEncoding(acceptEncoding);
    
    if (!encoding) {
      this.stats.skipped++;
      return response;
    }

    const contentType = response.headers.get('content-type');
    if (!this.shouldCompress(contentType)) {
      this.stats.skipped++;
      return response;
    }

    // Check content length
    const contentLength = parseInt(response.headers.get('content-length') ?? '0');
    if (contentLength > 0 && contentLength < this.minSize) {
      this.stats.skipped++;
      return response;
    }

    // Compress
    try {
      const compressedStream = this.compressStream(response.body, encoding);
      const newHeaders = new Headers(response.headers);
      
      newHeaders.set('Content-Encoding', encoding);
      newHeaders.delete('Content-Length'); // Length will change
      
      // Add vary header for caching
      const vary = response.headers.get('vary');
      if (vary) {
        if (!vary.includes('Accept-Encoding')) {
          newHeaders.set('Vary', `${vary}, Accept-Encoding`);
        }
      } else {
        newHeaders.set('Vary', 'Accept-Encoding');
      }

      this.stats.compressed++;

      return new Response(compressedStream, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (error) {
      console.error('Compression error:', error);
      return response;
    }
  }

  compressStream(body, encoding) {
    const format = encoding === 'br' ? 'deflate' : 'gzip';
    const ts = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      }
    });
    
    // Use CompressionStream if available
    return body.pipeThrough(new CompressionStream(format));
  }

  /**
   * Get compression statistics
   * @returns {Object} Compression stats
   */
  getStats() {
    const ratio = this.stats.bytesOut > 0 
      ? ((this.stats.bytesIn - this.stats.bytesOut) / this.stats.bytesIn * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      compressionRatio: `${ratio}%`
    };
  }
}

// ============ CONNECTION MULTIPLEXING ============

/**
 * Connection multiplexer for efficient resource usage
 */
export class ConnectionMultiplexer {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections ?? 10;
    this.idleTimeout = options.idleTimeout ?? 30000;
    this.connections = new Map();
    this.requestQueue = [];
    this.stats = {
      created: 0,
      reused: 0,
      closed: 0,
      queued: 0
    };
  }

  /**
   * Get or create a connection for a key
   * @param {string} key - Connection key (e.g., host:port)
   * @param {Function} createFn - Function to create new connection
   * @returns {Object} Connection object
   */
  async acquire(key, createFn) {
    // Check for existing idle connection
    const pool = this.connections.get(key);
    if (pool && pool.length > 0) {
      const conn = pool.pop();
      if (this.isConnectionValid(conn)) {
        this.stats.reused++;
        return conn;
      }
    }

    // Check if we can create a new connection
    if (this.getTotalConnections() < this.maxConnections) {
      const conn = await createFn();
      this.stats.created++;
      return conn;
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      this.stats.queued++;
      this.requestQueue.push({ key, createFn, resolve, reject });
    });
  }

  /**
   * Release a connection back to the pool
   * @param {string} key - Connection key
   * @param {Object} connection - Connection to release
   */
  release(key, connection) {
    if (!this.isConnectionValid(connection)) {
      this.stats.closed++;
      return;
    }

    // Check if there's a queued request waiting
    const queueIndex = this.requestQueue.findIndex(r => r.key === key);
    if (queueIndex >= 0) {
      const { resolve } = this.requestQueue.splice(queueIndex, 1)[0];
      this.stats.reused++;
      resolve(connection);
      return;
    }

    // Add to pool
    if (!this.connections.has(key)) {
      this.connections.set(key, []);
    }
    this.connections.get(key).push(connection);

    // Set idle timeout
    this.setIdleTimeout(key, connection);
  }

  isConnectionValid(connection) {
    if (!connection) return false;
    if (connection.closed) return false;
    if (connection.destroyed) return false;
    return true;
  }

  setIdleTimeout(key, connection) {
    connection._idleTimeout = setTimeout(() => {
      const pool = this.connections.get(key);
      if (pool) {
        const index = pool.indexOf(connection);
        if (index >= 0) {
          pool.splice(index, 1);
          this.stats.closed++;
        }
      }
    }, this.idleTimeout);
  }

  getTotalConnections() {
    let total = 0;
    for (const pool of this.connections.values()) {
      total += pool.length;
    }
    return total;
  }

  /**
   * Get multiplexer statistics
   * @returns {Object} Stats
   */
  getStats() {
    return {
      ...this.stats,
      activePools: this.connections.size,
      totalConnections: this.getTotalConnections(),
      queuedRequests: this.requestQueue.length
    };
  }

  /**
   * Close all connections
   */
  closeAll() {
    for (const [key, pool] of this.connections) {
      for (const conn of pool) {
        if (conn._idleTimeout) clearTimeout(conn._idleTimeout);
        if (typeof conn.close === 'function') conn.close();
        this.stats.closed++;
      }
    }
    this.connections.clear();

    // Reject queued requests
    for (const { reject } of this.requestQueue) {
      reject(new Error('Connection pool closed'));
    }
    this.requestQueue = [];
  }
}

// ============ ADAPTIVE THROTTLING ============

/**
 * Adaptive throttling based on system conditions
 */
export class AdaptiveThrottler {
  constructor(options = {}) {
    this.minRequests = options.minRequests ?? 10;
    this.maxRequests = options.maxRequests ?? 1000;
    this.currentLimit = options.initialLimit ?? 100;
    this.targetLatency = options.targetLatency ?? 200; // ms
    this.tolerance = options.tolerance ?? 0.1; // 10% tolerance
    this.adjustmentInterval = options.adjustmentInterval ?? 5000; // 5 seconds
    
    this.requests = [];
    this.latencies = [];
    this.errors = [];
    this.lastAdjustment = Date.now();
    this.stats = {
      currentLimit: this.currentLimit,
      adjustments: 0,
      throttledRequests: 0
    };
  }

  /**
   * Check if a request should be allowed
   * @returns {Object} { allowed, waitTime }
   */
  check() {
    const now = Date.now();
    const windowStart = now - 1000; // 1 second window
    
    // Count recent requests
    this.requests = this.requests.filter(t => t > windowStart);
    const recentCount = this.requests.length;

    if (recentCount >= this.currentLimit) {
      this.stats.throttledRequests++;
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + 1000 - now;
      return { allowed: false, waitTime: Math.max(0, waitTime) };
    }

    this.requests.push(now);
    return { allowed: true, waitTime: 0 };
  }

  /**
   * Record a latency measurement
   * @param {number} latency - Request latency in ms
   * @param {boolean} success - Whether request succeeded
   */
  record(latency, success = true) {
    this.latencies.push(latency);
    if (!success) {
      this.errors.push(Date.now());
    }

    // Keep bounded history
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }
    this.errors = this.errors.filter(t => t > Date.now() - 60000);

    // Periodic adjustment
    if (Date.now() - this.lastAdjustment >= this.adjustmentInterval) {
      this.adjust();
    }
  }

  /**
   * Adjust the rate limit based on performance
   */
  adjust() {
    this.lastAdjustment = Date.now();

    if (this.latencies.length < 10) return;

    const avgLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    const errorRate = this.errors.length / Math.max(1, this.latencies.length);
    
    let newLimit = this.currentLimit;

    // Latency-based adjustment
    if (avgLatency > this.targetLatency * (1 + this.tolerance)) {
      // Latency too high, decrease limit
      const decrease = Math.ceil(this.currentLimit * 0.1);
      newLimit = Math.max(this.minRequests, this.currentLimit - decrease);
    } else if (avgLatency < this.targetLatency * (1 - this.tolerance)) {
      // Latency good, can increase
      const increase = Math.ceil(this.currentLimit * 0.05);
      newLimit = Math.min(this.maxRequests, this.currentLimit + increase);
    }

    // Error-based adjustment
    if (errorRate > 0.05) { // > 5% errors
      newLimit = Math.max(this.minRequests, Math.floor(newLimit * 0.8));
    }

    if (newLimit !== this.currentLimit) {
      this.currentLimit = newLimit;
      this.stats.adjustments++;
      this.stats.currentLimit = newLimit;
    }

    // Reset for next interval
    this.latencies = [];
  }

  /**
   * Get current throttling state
   * @returns {Object} Throttler state
   */
  getStats() {
    return {
      ...this.stats,
      recentRequests: this.requests.length,
      errorRate: this.errors.length / Math.max(1, this.latencies.length)
    };
  }
}

// ============ CACHING LAYER ============

/**
 * Multi-tier caching layer
 */
export class CacheLayer {
  constructor(options = {}) {
    this.l1Cache = new Map(); // In-memory (fastest)
    this.l2Cache = null; // KV namespace (if available)
    this.l1MaxSize = options.l1MaxSize ?? 100;
    this.l1TTL = options.l1TTL ?? 60000; // 1 minute
    this.l2TTL = options.l2TTL ?? 300000; // 5 minutes
    
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      sets: 0
    };
  }

  /**
   * Set L2 cache (KV namespace)
   * @param {Object} kv - KV namespace
   */
  setL2Cache(kv) {
    this.l2Cache = kv;
  }

  /**
   * Get from cache
   * @param {string} key - Cache key
   * @returns {any} Cached value or null
   */
  async get(key) {
    // Check L1
    const l1Entry = this.l1Cache.get(key);
    if (l1Entry && l1Entry.expiry > Date.now()) {
      this.stats.l1Hits++;
      return l1Entry.value;
    }

    this.stats.l1Misses++;

    // Check L2
    if (this.l2Cache) {
      try {
        const l2Value = await this.l2Cache.get(key, { type: 'json' });
        if (l2Value !== null) {
          this.stats.l2Hits++;
          // Promote to L1
          this.l1Cache.set(key, {
            value: l2Value,
            expiry: Date.now() + this.l1TTL
          });
          this.trimL1();
          return l2Value;
        }
      } catch (err) {
        console.error('L2 cache read error:', err);
      }
    }

    this.stats.l2Misses++;
    return null;
  }

  /**
   * Set in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {Object} options - Cache options
   */
  async set(key, value, options = {}) {
    const ttl = options.ttl ?? this.l1TTL;
    const l2Ttl = options.l2TTL ?? this.l2TTL;

    // Set in L1
    this.l1Cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
    this.trimL1();
    this.stats.sets++;

    // Set in L2
    if (this.l2Cache && !options.l1Only) {
      try {
        await this.l2Cache.put(key, JSON.stringify(value), {
          expirationTtl: Math.floor(l2Ttl / 1000)
        });
      } catch (err) {
        console.error('L2 cache write error:', err);
      }
    }
  }

  /**
   * Delete from cache
   * @param {string} key - Cache key
   */
  async delete(key) {
    this.l1Cache.delete(key);
    
    if (this.l2Cache) {
      try {
        await this.l2Cache.delete(key);
      } catch (err) {
        console.error('L2 cache delete error:', err);
      }
    }
  }

  trimL1() {
    if (this.l1Cache.size > this.l1MaxSize) {
      const now = Date.now();
      // Remove expired first
      for (const [key, entry] of this.l1Cache) {
        if (entry.expiry <= now) {
          this.l1Cache.delete(key);
        }
      }
      // If still too large, remove oldest
      if (this.l1Cache.size > this.l1MaxSize) {
        const keys = [...this.l1Cache.keys()];
        const toRemove = keys.slice(0, keys.length - this.l1MaxSize);
        for (const key of toRemove) {
          this.l1Cache.delete(key);
        }
      }
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const l1HitRate = this.stats.l1Hits / Math.max(1, this.stats.l1Hits + this.stats.l1Misses);
    const l2HitRate = this.stats.l2Hits / Math.max(1, this.stats.l2Hits + this.stats.l2Misses);
    
    return {
      ...this.stats,
      l1HitRate: `${(l1HitRate * 100).toFixed(2)}%`,
      l2HitRate: `${(l2HitRate * 100).toFixed(2)}%`,
      l1Size: this.l1Cache.size,
      l2Enabled: this.l2Cache !== null
    };
  }

  /**
   * Clear all caches
   */
  async clear() {
    this.l1Cache.clear();
    // Note: We don't clear L2 (KV) as it would be expensive
  }
}

// ============ DEFAULT INSTANCES ============

export const defaultPipeline = new RequestPipeline();
export const defaultCompression = new CompressionManager();
export const defaultMultiplexer = new ConnectionMultiplexer();
export const defaultThrottler = new AdaptiveThrottler();
export const defaultCache = new CacheLayer();

// ============ EXPORTS ============

export default {
  RequestPipeline,
  CompressionManager,
  ConnectionMultiplexer,
  AdaptiveThrottler,
  CacheLayer,
  defaultPipeline,
  defaultCompression,
  defaultMultiplexer,
  defaultThrottler,
  defaultCache
};
