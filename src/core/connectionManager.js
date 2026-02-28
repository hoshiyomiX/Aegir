/**
 * Enhanced Connection Manager with Health Monitoring
 * 
 * Features:
 * - Smart connection pooling with health tracking
 * - Connection warmup and pre-establishment
 * - Health score calculation per destination
 * - Predictive connection allocation
 */

import { connect } from "cloudflare:sockets";
import { 
  connectionPool, 
  poolStats, 
  safeClearOldest 
} from './state.js';
import { 
  CIRCUIT_STATE, 
  circuitBreakerManager 
} from './circuitBreaker.js';
import { 
  POOL_MAX_SIZE, 
  POOL_IDLE_TIMEOUT,
  TIMEOUT_DEFAULT
} from '../config/constants.js';

// Connection health states
export const CONNECTION_HEALTH = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  UNHEALTHY: 'UNHEALTHY',
  UNKNOWN: 'UNKNOWN'
};

// Configuration
const HEALTH_CONFIG = {
  latencyThresholdHealthy: 500,    // < 500ms = healthy
  latencyThresholdDegraded: 2000,  // < 2000ms = degraded
  errorRateThreshold: 0.1,          // 10% error rate threshold
  healthCheckInterval: 30000,       // 30 seconds
  minSamplesForHealth: 5,           // Minimum samples before health assessment
  connectionTimeout: TIMEOUT_DEFAULT
};

/**
 * Connection Health Tracker
 * Tracks health metrics per destination
 */
class ConnectionHealthTracker {
  constructor() {
    this.healthData = new Map();
  }
  
  /**
   * Get or create health record for destination
   */
  getHealthRecord(address, port) {
    const key = `${address}:${port}`;
    if (!this.healthData.has(key)) {
      this.healthData.set(key, {
        address,
        port,
        totalConnections: 0,
        successfulConnections: 0,
        failedConnections: 0,
        totalLatency: 0,
        latencySamples: [],
        lastSuccess: null,
        lastFailure: null,
        lastHealthCheck: null,
        health: CONNECTION_HEALTH.UNKNOWN,
        healthScore: 100,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0
      });
    }
    return this.healthData.get(key);
  }
  
  /**
   * Record connection success
   */
  recordSuccess(address, port, latency) {
    const record = this.getHealthRecord(address, port);
    record.totalConnections++;
    record.successfulConnections++;
    record.totalLatency += latency;
    record.lastSuccess = Date.now();
    record.consecutiveFailures = 0;
    record.consecutiveSuccesses++;
    
    // Keep last 10 latency samples
    record.latencySamples.push(latency);
    if (record.latencySamples.length > 10) {
      record.latencySamples.shift();
    }
    
    this.updateHealthScore(record);
  }
  
  /**
   * Record connection failure
   */
  recordFailure(address, port, error) {
    const record = this.getHealthRecord(address, port);
    record.totalConnections++;
    record.failedConnections++;
    record.lastFailure = Date.now();
    record.consecutiveFailures++;
    record.consecutiveSuccesses = 0;
    
    this.updateHealthScore(record);
  }
  
  /**
   * Update health score based on metrics
   */
  updateHealthScore(record) {
    let score = 100;
    
    // Factor 1: Error rate (0-40 points)
    if (record.totalConnections > 0) {
      const errorRate = record.failedConnections / record.totalConnections;
      score -= Math.min(40, errorRate * 100);
    }
    
    // Factor 2: Latency (0-30 points)
    if (record.latencySamples.length > 0) {
      const avgLatency = record.latencySamples.reduce((a, b) => a + b, 0) / record.latencySamples.length;
      if (avgLatency > HEALTH_CONFIG.latencyThresholdDegraded) {
        score -= 30;
      } else if (avgLatency > HEALTH_CONFIG.latencyThresholdHealthy) {
        score -= 15;
      }
    }
    
    // Factor 3: Consecutive failures (0-30 points)
    score -= Math.min(30, record.consecutiveFailures * 10);
    
    // Update health status
    record.healthScore = Math.max(0, score);
    
    if (record.healthScore >= 80) {
      record.health = CONNECTION_HEALTH.HEALTHY;
    } else if (record.healthScore >= 50) {
      record.health = CONNECTION_HEALTH.DEGRADED;
    } else {
      record.health = CONNECTION_HEALTH.UNHEALTHY;
    }
  }
  
  /**
   * Get health status for destination
   */
  getHealth(address, port) {
    const record = this.getHealthRecord(address, port);
    
    if (record.totalConnections < HEALTH_CONFIG.minSamplesForHealth) {
      return { health: CONNECTION_HEALTH.UNKNOWN, score: 100, record };
    }
    
    return { health: record.health, score: record.healthScore, record };
  }
  
  /**
   * Get average latency for destination
   */
  getAverageLatency(address, port) {
    const record = this.getHealthRecord(address, port);
    if (record.latencySamples.length === 0) return null;
    return record.latencySamples.reduce((a, b) => a + b, 0) / record.latencySamples.length;
  }
  
  /**
   * Cleanup old records
   */
  cleanup(maxAge = 3600000) { // 1 hour default
    const cutoff = Date.now() - maxAge;
    for (const [key, record] of this.healthData) {
      if (record.lastSuccess < cutoff && record.lastFailure < cutoff) {
        this.healthData.delete(key);
      }
    }
  }
}

/**
 * Enhanced Connection Pool with Health Awareness
 */
class EnhancedConnectionPool {
  constructor() {
    this.pool = connectionPool;
    this.healthTracker = new ConnectionHealthTracker();
    this.warmupQueue = new Map(); // Pending warmup connections
    this.stats = {
      warmupHits: 0,
      warmupMisses: 0,
      healthBasedRouting: 0
    };
  }
  
  /**
   * Get connection with health awareness
   */
  async getConnection(address, port, options = {}) {
    const key = `${address}:${port}`;
    const startTime = Date.now();
    
    // Check circuit breaker first
    const circuit = circuitBreakerManager.getCircuit(key);
    const circuitCheck = circuit.canExecute();
    
    if (!circuitCheck.allowed) {
      throw new Error(`Circuit breaker open for ${key}: ${circuitCheck.reason}`);
    }
    
    // Try to get from pool
    const pooled = this.getPooledConnection(key);
    if (pooled) {
      return { socket: pooled, fromPool: true, latency: 0 };
    }
    
    // Create new connection
    try {
      const socket = await this.createConnection(address, port, options);
      const latency = Date.now() - startTime;
      
      // Record success
      this.healthTracker.recordSuccess(address, port, latency);
      circuit.recordSuccess();
      
      return { socket, fromPool: false, latency };
    } catch (error) {
      // Record failure
      this.healthTracker.recordFailure(address, port, error);
      circuit.recordFailure(error);
      
      throw error;
    }
  }
  
  /**
   * Get pooled connection if available and valid
   */
  getPooledConnection(key) {
    const entry = this.pool.get(key);
    
    if (!entry) {
      poolStats.misses++;
      return null;
    }
    
    // Check expiration
    const age = Date.now() - entry.timestamp;
    if (age > POOL_IDLE_TIMEOUT) {
      this.closeSocket(entry.socket);
      this.pool.delete(key);
      poolStats.misses++;
      return null;
    }
    
    // Check if socket is still valid
    if (entry.socket.closed) {
      this.pool.delete(key);
      poolStats.misses++;
      return null;
    }
    
    // Valid connection
    this.pool.delete(key);
    poolStats.hits++;
    return entry.socket;
  }
  
  /**
   * Create new connection
   */
  async createConnection(address, port, options = {}) {
    const timeout = options.timeout || HEALTH_CONFIG.connectionTimeout;
    
    const socket = connect({
      hostname: address,
      port: port
    });
    
    // Wait for connection to be established
    // Cloudflare sockets are immediately available, but we can add validation
    
    return socket;
  }
  
  /**
   * Return connection to pool with health consideration
   */
  returnConnection(socket, address, port, log) {
    if (!socket || socket.closed) {
      return false;
    }
    
    const key = `${address}:${port}`;
    
    // Check health before pooling
    const { health, score } = this.healthTracker.getHealth(address, port);
    if (health === CONNECTION_HEALTH.UNHEALTHY) {
      // Don't pool unhealthy connections
      this.closeSocket(socket);
      return false;
    }
    
    // Check if already in pool
    if (this.pool.has(key)) {
      const existing = this.pool.get(key);
      this.closeSocket(existing.socket);
      this.pool.delete(key);
    }
    
    // Evict if full
    if (this.pool.size >= POOL_MAX_SIZE) {
      this.evictOldest();
    }
    
    // Add to pool
    this.pool.set(key, {
      socket,
      timestamp: Date.now(),
      healthScore: score
    });
    
    if (log) {
      log(`Returned to pool: ${key} (health: ${health}, score: ${score})`);
    }
    
    return true;
  }
  
  /**
   * Close socket safely
   */
  closeSocket(socket) {
    try {
      if (socket && !socket.closed) {
        socket.close();
      }
    } catch (e) {
      // Silent fail
    }
  }
  
  /**
   * Evict oldest entry from pool
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.pool) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      const entry = this.pool.get(oldestKey);
      this.closeSocket(entry.socket);
      this.pool.delete(oldestKey);
      poolStats.evictions++;
    }
  }
  
  /**
   * Pre-warm connections for known destinations
   */
  async warmupConnections(destinations, log) {
    const results = [];
    
    for (const dest of destinations) {
      const { address, port } = dest;
      const key = `${address}:${port}`;
      
      // Skip if already have a pooled connection
      if (this.pool.has(key)) {
        this.stats.warmupHits++;
        continue;
      }
      
      try {
        const socket = await this.createConnection(address, port);
        this.pool.set(key, {
          socket,
          timestamp: Date.now(),
          healthScore: 100
        });
        this.stats.warmupMisses++;
        
        results.push({ address, port, success: true });
        
        if (log) {
          log(`Warmup: ${key} established`);
        }
      } catch (error) {
        results.push({ address, port, success: false, error: error.message });
      }
    }
    
    return results;
  }
  
  /**
   * Get best destination based on health scores
   */
  getBestDestination(destinations) {
    let best = null;
    let bestScore = -1;
    
    for (const dest of destinations) {
      const { health, score } = this.healthTracker.getHealth(dest.address, dest.port);
      
      // Skip unhealthy destinations
      if (health === CONNECTION_HEALTH.UNHEALTHY) {
        continue;
      }
      
      // Prefer pooled connections
      const key = `${dest.address}:${dest.port}`;
      const pooled = this.pool.has(key);
      const adjustedScore = score + (pooled ? 10 : 0);
      
      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        best = dest;
      }
    }
    
    this.stats.healthBasedRouting++;
    return best || destinations[0]; // Fallback to first if all unhealthy
  }
  
  /**
   * Get comprehensive stats
   */
  getStats() {
    return {
      pool: {
        size: this.pool.size,
        maxSize: POOL_MAX_SIZE,
        hits: poolStats.hits,
        misses: poolStats.misses,
        evictions: poolStats.evictions
      },
      health: {
        records: this.healthTracker.healthData.size
      },
      warmup: this.stats,
      circuits: circuitBreakerManager.getAggregateStats()
    };
  }
}

// Global instance
export const connectionManager = new EnhancedConnectionPool();
export const healthTracker = connectionManager.healthTracker;

export default {
  EnhancedConnectionPool,
  ConnectionHealthTracker,
  connectionManager,
  healthTracker,
  CONNECTION_HEALTH
};
