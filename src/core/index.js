/**
 * Core Module Index
 * Exports all core functionality for the Aegir proxy server
 */

// State Management
export {
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
} from './state.js';

// Diagnostics
export { formatStats } from './diagnostics.js';

/**
 * Get memory and cache summary
 */
export function getSystemStatus() {
  const memorySummary = getMemorySummary();
  
  return {
    timestamp: new Date().toISOString(),
    memory: memorySummary,
    stats: formatStats()
  };
}

/**
 * Perform system health check
 */
export function healthCheck() {
  const status = getSystemStatus();
  const issues = [];
  
  // Check memory usage
  const memoryUsage = status.memory;
  for (const [name, size] of Object.entries(memoryUsage)) {
    if (name.endsWith('Size') && size > 40) {
      issues.push({
        severity: 'MEDIUM',
        category: 'MEMORY',
        message: `${name} is at ${size} entries`
      });
    }
  }
  
  return {
    healthy: issues.length === 0,
    issues,
    status
  };
}

export default {
  getSystemStatus,
  healthCheck
};
