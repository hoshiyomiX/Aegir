/**
 * Circuit Breaker Implementation for Connection Management
 * Prevents cascading failures by temporarily stopping requests to failing endpoints
 * 
 * States: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
 */

// Circuit states
export const CIRCUIT_STATE = {
  CLOSED: 'CLOSED',      // Normal operation, requests flow through
  OPEN: 'OPEN',          // Failing, requests are rejected immediately
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

// Circuit breaker configuration
export const CIRCUIT_CONFIG = {
  FAILURE_THRESHOLD: 5,        // Number of failures before opening
  SUCCESS_THRESHOLD: 3,        // Number of successes in half-open to close
  TIMEOUT: 30000,              // Time in OPEN before trying HALF_OPEN (30s)
  VOLUME_THRESHOLD: 10,        // Minimum requests before evaluating
  WINDOW_SIZE: 60000,          // Sliding window for metrics (60s)
};

/**
 * Circuit Breaker for a single endpoint
 */
class CircuitBreaker {
  constructor(key, config = {}) {
    this.key = key;
    this.config = { ...CIRCUIT_CONFIG, ...config };
    this.state = CIRCUIT_STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.lastStateChange = Date.now();
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      totalRejects: 0,
      totalTimeouts: 0,
      avgLatency: 0,
      latencySamples: [],
    };
    this.slidingWindow = []; // Track recent requests for volume threshold
  }

  /**
   * Check if request should be allowed
   * @returns {Object} { allowed: boolean, state: string }
   */
  canExecute() {
    const now = Date.now();
    
    // Clean old entries from sliding window
    this._cleanSlidingWindow(now);
    
    if (this.state === CIRCUIT_STATE.CLOSED) {
      return { allowed: true, state: this.state };
    }
    
    if (this.state === CIRCUIT_STATE.OPEN) {
      // Check if timeout has passed to try half-open
      if (now - this.lastFailureTime >= this.config.TIMEOUT) {
        this._transitionTo(CIRCUIT_STATE.HALF_OPEN);
        return { allowed: true, state: this.state };
      }
      this.metrics.totalRejects++;
      return { allowed: false, state: this.state };
    }
    
    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      // Allow limited requests in half-open state
      return { allowed: true, state: this.state };
    }
    
    return { allowed: false, state: this.state };
  }

  /**
   * Record successful execution
   * @param {number} latency - Request latency in ms
   */
  recordSuccess(latency = 0) {
    const now = Date.now();
    this.metrics.totalRequests++;
    this.metrics.totalSuccesses++;
    this._updateLatency(latency);
    this.slidingWindow.push({ time: now, success: true });
    
    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.SUCCESS_THRESHOLD) {
        this._transitionTo(CIRCUIT_STATE.CLOSED);
      }
    } else if (this.state === CIRCUIT_STATE.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Record failed execution
   * @param {Error} error - The error that occurred
   */
  recordFailure(error) {
    const now = Date.now();
    this.metrics.totalRequests++;
    this.metrics.totalFailures++;
    this.lastFailureTime = now;
    this.slidingWindow.push({ time: now, success: false, error: error?.message });
    
    if (this.state === CIRCUIT_STATE.HALF_OPEN) {
      // Any failure in half-open immediately opens
      this._transitionTo(CIRCUIT_STATE.OPEN);
    } else if (this.state === CIRCUIT_STATE.CLOSED) {
      this.failureCount++;
      this._checkFailureThreshold();
    }
  }

  /**
   * Record timeout
   */
  recordTimeout() {
    this.metrics.totalTimeouts++;
    this.recordFailure(new Error('Request timeout'));
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const windowFailures = this.slidingWindow.filter(e => !e.success).length;
    const windowTotal = this.slidingWindow.length;
    const failureRate = windowTotal > 0 ? (windowFailures / windowTotal * 100).toFixed(1) : 0;
    
    return {
      key: this.key,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      uptime: Date.now() - this.lastStateChange,
      failureRate: `${failureRate}%`,
      windowStats: {
        total: windowTotal,
        failures: windowFailures,
        successes: windowTotal - windowFailures
      },
      ...this.metrics
    };
  }

  /**
   * Force reset the circuit
   */
  reset() {
    this._transitionTo(CIRCUIT_STATE.CLOSED);
  }

  /**
   * Force open the circuit
   */
  trip() {
    this._transitionTo(CIRCUIT_STATE.OPEN);
  }

  // Private methods

  _transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();
    
    if (newState === CIRCUIT_STATE.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CIRCUIT_STATE.OPEN) {
      this.successCount = 0;
    } else if (newState === CIRCUIT_STATE.HALF_OPEN) {
      this.successCount = 0;
    }
    
    console.log(`[CircuitBreaker] ${this.key}: ${oldState} -> ${newState}`);
  }

  _checkFailureThreshold() {
    // Check volume threshold first
    if (this.slidingWindow.length < this.config.VOLUME_THRESHOLD) {
      return;
    }
    
    // Check failure count
    if (this.failureCount >= this.config.FAILURE_THRESHOLD) {
      this._transitionTo(CIRCUIT_STATE.OPEN);
      return;
    }
    
    // Check failure rate in sliding window
    const failures = this.slidingWindow.filter(e => !e.success).length;
    const failureRate = failures / this.slidingWindow.length;
    if (failureRate >= 0.5) { // 50% failure rate
      this._transitionTo(CIRCUIT_STATE.OPEN);
    }
  }

  _cleanSlidingWindow(now) {
    const cutoff = now - this.config.WINDOW_SIZE;
    this.slidingWindow = this.slidingWindow.filter(e => e.time >= cutoff);
  }

  _updateLatency(latency) {
    if (latency <= 0) return;
    this.metrics.latencySamples.push(latency);
    if (this.metrics.latencySamples.length > 100) {
      this.metrics.latencySamples.shift();
    }
    const sum = this.metrics.latencySamples.reduce((a, b) => a + b, 0);
    this.metrics.avgLatency = Math.round(sum / this.metrics.latencySamples.length);
  }
}

/**
 * Circuit Breaker Manager - Manages multiple circuit breakers
 */
class CircuitBreakerManager {
  constructor() {
    this.circuits = new Map();
    this.config = { ...CIRCUIT_CONFIG };
  }

  /**
   * Get or create circuit breaker for endpoint
   * @param {string} key - Endpoint identifier (e.g., "example.com:443")
   * @param {Object} config - Optional custom config
   */
  getCircuit(key, config = {}) {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, new CircuitBreaker(key, { ...this.config, ...config }));
    }
    return this.circuits.get(key);
  }

  /**
   * Check if request should be allowed for endpoint
   */
  canExecute(key) {
    const circuit = this.getCircuit(key);
    return circuit.canExecute();
  }

  /**
   * Record success for endpoint
   */
  recordSuccess(key, latency = 0) {
    const circuit = this.getCircuit(key);
    circuit.recordSuccess(latency);
  }

  /**
   * Record failure for endpoint
   */
  recordFailure(key, error) {
    const circuit = this.getCircuit(key);
    circuit.recordFailure(error);
  }

  /**
   * Record timeout for endpoint
   */
  recordTimeout(key) {
    const circuit = this.getCircuit(key);
    circuit.recordTimeout();
  }

  /**
   * Get all circuit states
   */
  getAllMetrics() {
    const metrics = {};
    for (const [key, circuit] of this.circuits) {
      metrics[key] = circuit.getMetrics();
    }
    return metrics;
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    let totalCircuits = this.circuits.size;
    let openCircuits = 0;
    let halfOpenCircuits = 0;
    let closedCircuits = 0;
    
    for (const circuit of this.circuits.values()) {
      if (circuit.state === CIRCUIT_STATE.OPEN) openCircuits++;
      else if (circuit.state === CIRCUIT_STATE.HALF_OPEN) halfOpenCircuits++;
      else closedCircuits++;
    }
    
    return {
      total: totalCircuits,
      open: openCircuits,
      halfOpen: halfOpenCircuits,
      closed: closedCircuits,
      healthScore: totalCircuits > 0 ? Math.round((closedCircuits / totalCircuits) * 100) : 100
    };
  }

  /**
   * Reset all circuits
   */
  resetAll() {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
  }

  /**
   * Clean up old circuits (those not used recently)
   */
  cleanup(maxAge = 300000) { // 5 minutes default
    const now = Date.now();
    for (const [key, circuit] of this.circuits) {
      if (now - circuit.lastStateChange > maxAge && circuit.state === CIRCUIT_STATE.CLOSED) {
        this.circuits.delete(key);
      }
    }
  }
}

// Singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();

export default {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  CIRCUIT_STATE,
  CIRCUIT_CONFIG
};
