// Global mutable state
// In a Cloudflare Worker, this state persists across requests in the same isolate.
// CRITICAL FIX: All Maps and caches now have bounded sizes with cleanup mechanisms

// ============ CONSTANTS FOR BOUNDS ============
const MAX_DNS_CACHE_SIZE = 50;
const MAX_LATENCY_TRACKER_SIZE = 100;
const MAX_PENDING_REQUESTS_SIZE = 100;
const MAX_FLAG_CACHE_SIZE = 300; // ~260 countries max, add buffer
const MAX_CONNECTION_POOL_SIZE = 20;
const STATS_RESET_THRESHOLD = 1000000; // Reset stats after 1M operations to prevent overflow

// ============ BOUNDED MAP HELPERS ============

/**
 * Creates a bounded Map that automatically removes oldest entries when size limit is exceeded
 * CRITICAL FIX: Added safety checks to prevent infinite loops and edge cases
 * @param {number} maxSize - Maximum number of entries
 * @returns {Map} - Bounded Map instance
 */
function createBoundedMap(maxSize) {
  const map = new Map();
  
  // Store original set method
  const originalSet = map.set.bind(map);
  
  // Safety check: ensure maxSize is valid
  const safeMaxSize = Math.max(1, maxSize || 50);
  
  // Override set method to enforce size limit
  map.set = function(key, value) {
    // If key already exists, delete it first (to update insertion order)
    if (map.has(key)) {
      map.delete(key);
      // After deletion, we have space, so just set the new value
      return originalSet(key, value);
    }
    
    // Enforce size limit by removing oldest entry (only if needed)
    if (map.size >= safeMaxSize) {
      const oldestKey = map.keys().next().value;
      // CRITICAL FIX: Check if oldestKey is defined before deleting
      if (oldestKey !== undefined) {
        map.delete(oldestKey);
      }
    }
    return originalSet(key, value);
  };
  
  return map;
}

/**
 * Safely clears entries from a Map up to a limit
 * @param {Map} map - The Map to clear from
 * @param {number} count - Number of entries to remove
 */
export function safeClearOldest(map, count) {
  let deleted = 0;
  for (const key of map.keys()) {
    if (deleted >= count) break;
    map.delete(key);
    deleted++;
  }
}

// ============ CACHE ============
export const inMemoryCache = {
  prxList: { data: null, timestamp: 0 },
  kvPrxList: { data: null, timestamp: 0 }
};

// ============ DNS CACHE (BOUNDED) ============
export const dnsCache = createBoundedMap(MAX_DNS_CACHE_SIZE);

// ============ METRICS / STATS WITH RESET ============

function createBoundedCounter(initialValue = 0) {
  let value = initialValue;
  return {
    get value() { return value; },
    increment(amount = 1) {
      value += amount;
      // Auto-reset if approaching MAX_SAFE_INTEGER
      if (value > STATS_RESET_THRESHOLD) {
        value = Math.floor(value / 10); // Keep 10% to maintain relative proportions
      }
    },
    reset() { value = 0; }
  };
}

// Using objects with getters for backward compatibility
// But with internal bounded counters
const _dnsStats = {
  hits: 0,
  misses: 0,
  dohSuccess: 0,
  dohFail: 0,
  fallback: 0
};

const _poolStats = { 
  hits: 0, 
  misses: 0, 
  evictions: 0 
};

const _bufferStats = {
  backpressureEvents: 0,
  queueOverflows: 0,
  totalQueued: 0,
  maxQueueDepth: 0
};

const _timeoutStats = { 
  adaptive: 0, 
  default: 0, 
  fastFail: 0,
  slowSuccess: 0 
};

const _batchStats = {
  batched: 0,
  unbatched: 0,
  totalBatchSavings: 0
};

const _retryStats = {
  attempts: 0,
  successes: 0,
  failures: 0,
  totalDelay: 0
};

const _coalesceStats = {
  hits: 0,
  misses: 0,
  saved: 0
};

const _streamingStats = {
  activeStreams: 0,
  totalStreamed: 0,
  streamingBytes: 0
};

// Helper to safely increment a stat counter
function safeIncrement(statsObj, key, amount = 1) {
  statsObj[key] = (statsObj[key] || 0) + amount;
  // Check for overflow and reset proportionally
  if (statsObj[key] > STATS_RESET_THRESHOLD) {
    for (const k in statsObj) {
      statsObj[k] = Math.floor(statsObj[k] / 10);
    }
  }
}

// Export stats with safe increment helper
export const dnsStats = new Proxy(_dnsStats, {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    if (value > STATS_RESET_THRESHOLD) {
      // Reset all stats proportionally
      for (const k in target) {
        target[k] = Math.floor(target[k] / 10);
      }
    }
    return true;
  }
});

export const poolStats = new Proxy(_poolStats, {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    if (value > STATS_RESET_THRESHOLD) {
      for (const k in target) {
        target[k] = Math.floor(target[k] / 10);
      }
    }
    return true;
  }
});

export const bufferStats = new Proxy(_bufferStats, {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    if (value > STATS_RESET_THRESHOLD) {
      for (const k in target) {
        target[k] = Math.floor(target[k] / 10);
      }
    }
    return true;
  }
});

export const timeoutStats = new Proxy(_timeoutStats, {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    if (value > STATS_RESET_THRESHOLD) {
      for (const k in target) {
        target[k] = Math.floor(target[k] / 10);
      }
    }
    return true;
  }
});

export const batchStats = new Proxy(_batchStats, {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    if (value > STATS_RESET_THRESHOLD) {
      for (const k in target) {
        target[k] = Math.floor(target[k] / 10);
      }
    }
    return true;
  }
});

export const retryStats = new Proxy(_retryStats, {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    if (value > STATS_RESET_THRESHOLD) {
      for (const k in target) {
        target[k] = Math.floor(target[k] / 10);
      }
    }
    return true;
  }
});

export const coalesceStats = new Proxy(_coalesceStats, {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    if (value > STATS_RESET_THRESHOLD) {
      for (const k in target) {
        target[k] = Math.floor(target[k] / 10);
      }
    }
    return true;
  }
});

export const streamingStats = new Proxy(_streamingStats, {
  get(target, prop) {
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    // For streaming bytes, use larger threshold
    if (prop === 'streamingBytes' && value > STATS_RESET_THRESHOLD * 1000) {
      target[prop] = Math.floor(value / 10);
    } else if (value > STATS_RESET_THRESHOLD) {
      for (const k in target) {
        if (k !== 'streamingBytes') {
          target[k] = Math.floor(target[k] / 10);
        }
      }
    }
    return true;
  }
});

// ============ LOGIC STATE (BOUNDED) ============

// Connection pool with strict size limit
export const connectionPool = createBoundedMap(MAX_CONNECTION_POOL_SIZE);

// Latency tracker - track RTT per destination
export const latencyTracker = createBoundedMap(MAX_LATENCY_TRACKER_SIZE);

// Pending requests - track in-flight requests
export const pendingRequests = createBoundedMap(MAX_PENDING_REQUESTS_SIZE);

// Flag emoji cache - bounded since countries are finite
export const FLAG_EMOJI_CACHE = createBoundedMap(MAX_FLAG_CACHE_SIZE);

// ============ CLEANUP FUNCTIONS ============

/**
 * Performs a comprehensive cleanup of all global state
 * Should be called periodically via ctx.waitUntil()
 */
export function performGlobalCleanup() {
  const now = Date.now();
  
  // Clean expired DNS entries
  const DNS_TTL = 600000; // 10 minutes
  for (const [hostname, entry] of dnsCache.entries()) {
    if (now - entry.timestamp >= DNS_TTL) {
      dnsCache.delete(hostname);
    }
  }
  
  // Ensure pending requests don't have stale entries
  // Entries should be removed by the deduplication logic,
  // but this is a safety net
  if (pendingRequests.size > MAX_PENDING_REQUESTS_SIZE / 2) {
    safeClearOldest(pendingRequests, 10);
  }
  
  // Latency tracker cleanup - remove entries that haven't been updated recently
  // This is handled by the bounded map, but we can do additional cleanup here
  if (latencyTracker.size > MAX_LATENCY_TRACKER_SIZE / 2) {
    safeClearOldest(latencyTracker, 20);
  }
}

/**
 * Resets all stats (useful for testing or periodic reset)
 */
export function resetAllStats() {
  for (const key in _dnsStats) _dnsStats[key] = 0;
  for (const key in _poolStats) _poolStats[key] = 0;
  for (const key in _bufferStats) _bufferStats[key] = 0;
  for (const key in _timeoutStats) _timeoutStats[key] = 0;
  for (const key in _batchStats) _batchStats[key] = 0;
  for (const key in _retryStats) _retryStats[key] = 0;
  for (const key in _coalesceStats) _coalesceStats[key] = 0;
  for (const key in _streamingStats) _streamingStats[key] = 0;
}

/**
 * Gets current memory usage summary (for diagnostics)
 */
export function getMemorySummary() {
  return {
    dnsCacheSize: dnsCache.size,
    connectionPoolSize: connectionPool.size,
    latencyTrackerSize: latencyTracker.size,
    pendingRequestsSize: pendingRequests.size,
    flagCacheSize: FLAG_EMOJI_CACHE.size,
    limits: {
      dnsCache: MAX_DNS_CACHE_SIZE,
      connectionPool: MAX_CONNECTION_POOL_SIZE,
      latencyTracker: MAX_LATENCY_TRACKER_SIZE,
      pendingRequests: MAX_PENDING_REQUESTS_SIZE,
      flagCache: MAX_FLAG_CACHE_SIZE
    }
  };
}

// ============ EXPORT DEFAULT ============
export default {
  inMemoryCache,
  dnsCache,
  dnsStats,
  poolStats,
  bufferStats,
  timeoutStats,
  batchStats,
  retryStats,
  coalesceStats,
  streamingStats,
  connectionPool,
  latencyTracker,
  pendingRequests,
  FLAG_EMOJI_CACHE,
  performGlobalCleanup,
  resetAllStats,
  getMemorySummary,
  safeClearOldest
};
