/**
 * Core Module Index
 * Exports all core functionality for the Aegir proxy server
 */

// Circuit Breaker
export {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  CIRCUIT_STATE
} from './circuitBreaker.js';

// Connection Manager
export {
  EnhancedConnectionPool,
  ConnectionHealthTracker,
  connectionManager,
  healthTracker,
  CONNECTION_HEALTH
} from './connectionManager.js';

// Buffer Manager
export {
  BufferManager,
  BufferPool,
  MemoryPressureMonitor,
  SmartCoalescer,
  ZeroCopyHandler,
  bufferManager,
  MEMORY_PRESSURE
} from './bufferManager.js';

// DNS Manager
export {
  DNSManager,
  ResolverHealthTracker,
  SWRCache,
  DNSPrefetcher,
  dnsManager,
  resolveDNS,
  DNS_CONFIG
} from './dnsManager.js';

// Error Handler
export {
  AppError,
  NetworkError,
  ProtocolError,
  TimeoutError,
  DNSError,
  MemoryError,
  ValidationError,
  ErrorBoundary,
  ErrorAggregator,
  errorAggregator,
  ERROR_CATEGORY,
  ERROR_SEVERITY,
  RECOVERY_STRATEGY
} from './errorHandler.js';

// Service Container
export {
  ServiceContainer,
  ApplicationContext,
  appContext,
  SERVICE_LIFECYCLE
} from './serviceContainer.js';

// State
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
 * Get comprehensive system status
 */
export async function getSystemStatus() {
  const connectionStats = connectionManager.getStats();
  const bufferStats = bufferManager.getStats();
  const dnsStats = dnsManager.getStats();
  const circuitStats = circuitBreakerManager.getAggregateStats();
  const errorSummary = errorAggregator.getSummary();
  
  return {
    timestamp: new Date().toISOString(),
    connections: connectionStats,
    buffers: bufferStats,
    dns: dnsStats,
    circuits: circuitStats,
    errors: errorSummary,
    uptime: process.uptime ? process.uptime() : null
  };
}

/**
 * Perform system health check
 */
export async function healthCheck() {
  const status = await getSystemStatus();
  const issues = [];
  
  // Check for high memory pressure
  if (status.buffers.pressure?.currentPressure === 'HIGH' || 
      status.buffers.pressure?.currentPressure === 'CRITICAL') {
    issues.push({
      severity: 'HIGH',
      category: 'MEMORY',
      message: `Memory pressure is ${status.buffers.pressure.currentPressure}`
    });
  }
  
  // Check for open circuits
  if (status.circuits.openCircuits > 0) {
    issues.push({
      severity: 'MEDIUM',
      category: 'CIRCUIT_BREAKER',
      message: `${status.circuits.openCircuits} circuit(s) are open`
    });
  }
  
  // Check DNS resolver health
  const unhealthyResolvers = Object.entries(status.dns.resolvers)
    .filter(([name, data]) => !data.isHealthy)
    .map(([name]) => name);
  
  if (unhealthyResolvers.length > 0) {
    issues.push({
      severity: 'LOW',
      category: 'DNS',
      message: `DNS resolvers unhealthy: ${unhealthyResolvers.join(', ')}`
    });
  }
  
  // Check error rate
  const recentErrors = status.errors.recent;
  if (recentErrors > 10) {
    issues.push({
      severity: 'MEDIUM',
      category: 'ERRORS',
      message: `High error rate: ${recentErrors} errors in last minute`
    });
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
