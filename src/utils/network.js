import { connect } from "cloudflare:sockets";
import { 
  latencyTracker, 
  timeoutStats, 
  connectionPool, 
  poolStats,
  retryStats,
  safeClearOldest
} from '../core/state.js';
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

// ============ ADAPTIVE TIMEOUT HELPERS (OPTIMIZATION 14) ============

/**
 * Generates a unique key for latency tracking
 * @param {string} address - The target address
 * @param {number} port - The target port
 * @returns {string} - Unique key
 */
export function getLatencyKey(address, port) {
  return `${address}:${port}`;
}

/**
 * Records latency measurement for adaptive timeout calculation
 * @param {string} address - The target address
 * @param {number} port - The target port
 * @param {number} latencyMs - The latency in milliseconds
 */
export function recordLatency(address, port, latencyMs) {
  const key = getLatencyKey(address, port);
  
  // Get or create history array
  let history = latencyTracker.get(key);
  if (!history) {
    history = [];
    latencyTracker.set(key, history);
  }
  
  // Add new measurement
  history.push(latencyMs);
  
  // Keep only recent history (bounded)
  if (history.length > LATENCY_HISTORY_SIZE) {
    history.shift();
  }
}

/**
 * Calculates adaptive timeout based on historical latency
 * @param {string} address - The target address
 * @param {number} port - The target port
 * @param {Function} log - Optional logging function
 * @returns {number} - Calculated timeout in milliseconds
 */
export function calculateAdaptiveTimeout(address, port, log) {
  const key = getLatencyKey(address, port);
  const history = latencyTracker.get(key);
  
  // No history available, use default
  if (!history || history.length === 0) {
    timeoutStats.default++;
    return TIMEOUT_DEFAULT;
  }
  
  // Calculate percentile (P95) for adaptive timeout
  const sorted = [...history].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p95Latency = sorted[p95Index] || sorted[sorted.length - 1];
  
  // Calculate adaptive timeout: P95 * multiplier
  let adaptiveTimeout = Math.floor(p95Latency * TIMEOUT_MULTIPLIER);
  
  // Clamp to min/max bounds
  adaptiveTimeout = Math.max(TIMEOUT_MIN, Math.min(TIMEOUT_MAX, adaptiveTimeout));
  
  timeoutStats.adaptive++;
  
  if (log) {
    log(`Adaptive timeout for ${key}: ${adaptiveTimeout}ms (P95 RTT: ${p95Latency}ms, samples: ${history.length})`);
  }
  
  return adaptiveTimeout;
}

/**
 * Cleans up old entries in latency tracker
 * Called periodically from main handler
 */
export function cleanupLatencyTracker() {
  // Use the bounded map's built-in cleanup via safeClearOldest
  if (latencyTracker.size > 50) {
    safeClearOldest(latencyTracker, 10);
  }
}

// ============ CONNECTION POOL HELPERS (OPTIMIZATION 12) ============
// CRITICAL FIX: Removed setTimeout-based cleanup, using timestamp-based expiration

/**
 * Maximum age for pooled connections in milliseconds
 */
const POOL_ENTRY_MAX_AGE = 60000; // 60 seconds

/**
 * Generates a unique key for connection pool
 * @param {string} address - The target address
 * @param {number} port - The target port
 * @returns {string} - Unique key
 */
export function getPoolKey(address, port) {
  return `${address}:${port}`;
}

/**
 * Checks if a pool entry has expired
 * @param {Object} entry - The pool entry
 * @returns {boolean} - True if expired
 */
function isPoolEntryExpired(entry) {
  if (!entry) return true;
  const age = Date.now() - entry.timestamp;
  return age > POOL_ENTRY_MAX_AGE;
}

/**
 * Safely closes a socket with error handling
 * @param {Object} socket - The socket to close
 */
function safeCloseSocket(socket) {
  if (!socket) return;
  try {
    if (!socket.closed) {
      socket.close();
    }
  } catch (e) {
    // Silent fail - socket may already be closed
  }
}

/**
 * Gets a connection from the pool if available and valid
 * CRITICAL FIX: No setTimeout, uses timestamp-based validation
 * 
 * @param {string} address - The target address
 * @param {number} port - The target port
 * @param {Function} log - Optional logging function
 * @returns {Object|null} - The pooled socket or null
 */
export async function getPooledConnection(address, port, log) {
  const key = getPoolKey(address, port);
  const poolEntry = connectionPool.get(key);
  
  // No entry found
  if (!poolEntry) {
    poolStats.misses++;
    return null;
  }
  
  // CRITICAL FIX: Check if entry is expired based on timestamp
  if (isPoolEntryExpired(poolEntry)) {
    // Entry expired, clean it up
    safeCloseSocket(poolEntry.socket);
    connectionPool.delete(key);
    poolStats.misses++;
    if (log) log(`Pool EXPIRED: ${key}`);
    return null;
  }
  
  // Check if socket is still valid
  if (poolEntry.socket.closed) {
    // Socket already closed, remove from pool
    connectionPool.delete(key);
    poolStats.misses++;
    return null;
  }
  
  // Valid connection found - remove from pool (one-time use)
  connectionPool.delete(key);
  poolStats.hits++;
  
  if (log) {
    log(`Pool HIT: ${key} (age: ${Date.now() - poolEntry.timestamp}ms, hits: ${poolStats.hits}, misses: ${poolStats.misses})`);
  }
  
  return poolEntry.socket;
}

/**
 * Returns a connection to the pool for reuse
 * CRITICAL FIX: No setTimeout, uses timestamp for expiration
 * 
 * @param {Object} tcpSocket - The socket to return
 * @param {string} address - The target address
 * @param {number} port - The target port
 * @param {Function} log - Optional logging function
 */
export function returnToPool(tcpSocket, address, port, log) {
  // Don't pool if socket is already closed or closing
  if (!tcpSocket || tcpSocket.closed) {
    return;
  }
  
  const key = getPoolKey(address, port);
  
  // Check if there's already an entry for this key (shouldn't happen, but be safe)
  if (connectionPool.has(key)) {
    const existing = connectionPool.get(key);
    safeCloseSocket(existing.socket);
    connectionPool.delete(key);
  }
  
  // Evict oldest/expired entries if pool is full
  if (connectionPool.size >= POOL_MAX_SIZE) {
    cleanupConnectionPool(log);
  }
  
  // CRITICAL FIX: Store with timestamp instead of setTimeout
  // The timestamp is checked when retrieving from pool
  connectionPool.set(key, {
    socket: tcpSocket,
    timestamp: Date.now(),
  });
  
  if (log) {
    log(`Returned to pool: ${key} (pool size: ${connectionPool.size}/${POOL_MAX_SIZE})`);
  }
}

/**
 * Cleans up expired and excess connections from the pool
 * CRITICAL FIX: Called explicitly instead of via setTimeout
 * 
 * @param {Function} log - Optional logging function
 * @returns {number} - Number of entries removed
 */
export function cleanupConnectionPool(log) {
  const now = Date.now();
  let removed = 0;
  
  // First pass: remove expired entries
  for (const [key, entry] of connectionPool.entries()) {
    if (isPoolEntryExpired(entry) || entry.socket.closed) {
      safeCloseSocket(entry.socket);
      connectionPool.delete(key);
      removed++;
      poolStats.evictions++;
    }
  }
  
  // Second pass: if still over limit, remove oldest entries
  while (connectionPool.size > POOL_MAX_SIZE) {
    // Find oldest entry
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of connectionPool.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      const entry = connectionPool.get(oldestKey);
      safeCloseSocket(entry.socket);
      connectionPool.delete(oldestKey);
      removed++;
      poolStats.evictions++;
    } else {
      break; // Safety: no entries found
    }
  }
  
  if (removed > 0 && log) {
    log(`Pool cleanup: removed ${removed} entries, size now ${connectionPool.size}`);
  }
  
  return removed;
}

/**
 * Gets pool statistics for diagnostics
 * @returns {Object} - Pool statistics
 */
export function getPoolStats() {
  let validCount = 0;
  let expiredCount = 0;
  let closedCount = 0;
  const now = Date.now();
  
  for (const [key, entry] of connectionPool.entries()) {
    if (entry.socket.closed) {
      closedCount++;
    } else if (isPoolEntryExpired(entry)) {
      expiredCount++;
    } else {
      validCount++;
    }
  }
  
  return {
    total: connectionPool.size,
    valid: validCount,
    expired: expiredCount,
    closed: closedCount,
    hits: poolStats.hits,
    misses: poolStats.misses,
    evictions: poolStats.evictions,
    hitRate: poolStats.hits + poolStats.misses > 0 
      ? (poolStats.hits / (poolStats.hits + poolStats.misses) * 100).toFixed(1) + '%'
      : 'N/A'
  };
}

// ============ BACKOFF CALCULATION (OPTIMIZATION 16) ============

/**
 * Calculates backoff delay with exponential backoff and jitter
 * @param {number} attempt - The retry attempt number (0-indexed)
 * @returns {number} - Delay in milliseconds
 */
export function calculateBackoff(attempt) {
  // Exponential backoff: base * 2^attempt, capped at max
  const exponentialDelay = Math.min(
    RETRY_BASE_DELAY * Math.pow(2, attempt),
    RETRY_MAX_DELAY
  );
  
  // Add jitter: ±30% randomization to prevent thundering herd
  const jitter = exponentialDelay * RETRY_JITTER_FACTOR * (Math.random() * 2 - 1);
  const totalDelay = Math.max(0, exponentialDelay + jitter);
  
  return Math.floor(totalDelay);
}

// ============ EXPORTS ============

export default {
  getLatencyKey,
  recordLatency,
  calculateAdaptiveTimeout,
  cleanupLatencyTracker,
  getPoolKey,
  getPooledConnection,
  returnToPool,
  cleanupConnectionPool,
  getPoolStats,
  calculateBackoff
};
