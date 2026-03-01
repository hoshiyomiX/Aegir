/**
 * Enhanced Error Handling & Resilience Module
 * Provides structured error types, recovery strategies, and graceful error propagation
 * 
 * @module core/errorHandling
 * @version 2.0.0
 */

// ============ ERROR TYPES ============

/**
 * Base error class for all Aegir errors
 */
export class AegirError extends Error {
  constructor(message, code, category = 'GENERAL', recoverable = true, context = {}) {
    super(message);
    this.name = 'AegirError';
    this.code = code;
    this.category = category;
    this.recoverable = recoverable;
    this.context = context;
    this.timestamp = Date.now();
    this.stack = this.captureStackTrace();
  }

  captureStackTrace() {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2).join('\n') : '';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      recoverable: this.recoverable,
      context: this.context,
      timestamp: this.timestamp
    };
  }
}

/**
 * Network-related errors (TCP, UDP, WebSocket)
 */
export class NetworkError extends AegirError {
  constructor(message, code = 'NET_ERROR', context = {}) {
    super(message, code, 'NETWORK', true, context);
    this.name = 'NetworkError';
  }

  static CONNECTION_TIMEOUT(host, port, timeout) {
    return new NetworkError(
      `Connection timeout to ${host}:${port} after ${timeout}ms`,
      'CONN_TIMEOUT',
      { host, port, timeout }
    );
  }

  static CONNECTION_REFUSED(host, port) {
    return new NetworkError(
      `Connection refused by ${host}:${port}`,
      'CONN_REFUSED',
      { host, port }
    );
  }

  static CONNECTION_RESET(host, port) {
    return new NetworkError(
      `Connection reset by ${host}:${port}`,
      'CONN_RESET',
      { host, port }
    );
  }

  static DNS_RESOLUTION_FAILED(hostname) {
    return new NetworkError(
      `DNS resolution failed for ${hostname}`,
      'DNS_FAILED',
      { hostname }
    );
  }

  static SOCKET_ERROR(message, context = {}) {
    return new NetworkError(message, 'SOCKET_ERROR', context);
  }
}

/**
 * Protocol parsing errors
 */
export class ProtocolError extends AegirError {
  constructor(message, code = 'PROTO_ERROR', context = {}) {
    super(message, code, 'PROTOCOL', false, context);
    this.name = 'ProtocolError';
  }

  static INVALID_HEADER(protocol, reason) {
    return new ProtocolError(
      `Invalid ${protocol} header: ${reason}`,
      'INVALID_HEADER',
      { protocol, reason }
    );
  }

  static UNSUPPORTED_COMMAND(command, protocol) {
    return new ProtocolError(
      `Unsupported command ${command} in ${protocol}`,
      'UNSUPPORTED_CMD',
      { command, protocol }
    );
  }

  static BUFFER_TOO_SHORT(expected, actual, protocol) {
    return new ProtocolError(
      `Buffer too short for ${protocol}: expected ${expected} bytes, got ${actual}`,
      'BUFFER_SHORT',
      { expected, actual, protocol }
    );
  }

  static INVALID_ADDRESS_TYPE(type, protocol) {
    return new ProtocolError(
      `Invalid address type ${type} in ${protocol}`,
      'INVALID_ADDR_TYPE',
      { type, protocol }
    );
  }

  static UNKNOWN_PROTOCOL(firstByte, bufferLength) {
    return new ProtocolError(
      `Unknown protocol detected`,
      'UNKNOWN_PROTO',
      { firstByte, bufferLength }
    );
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AegirError {
  constructor(message, code = 'CONFIG_ERROR', context = {}) {
    super(message, code, 'CONFIGURATION', false, context);
    this.name = 'ConfigurationError';
  }

  static MISSING_REQUIRED(param) {
    return new ConfigurationError(
      `Missing required configuration: ${param}`,
      'MISSING_CONFIG',
      { param }
    );
  }

  static INVALID_VALUE(param, value, expected) {
    return new ConfigurationError(
      `Invalid value for ${param}: got ${value}, expected ${expected}`,
      'INVALID_CONFIG',
      { param, value, expected }
    );
  }

  static VALIDATION_FAILED(errors) {
    return new ConfigurationError(
      `Configuration validation failed: ${errors.length} errors`,
      'VALIDATION_FAIL',
      { errors }
    );
  }
}

/**
 * Security-related errors
 */
export class SecurityError extends AegirError {
  constructor(message, code = 'SEC_ERROR', context = {}) {
    super(message, code, 'SECURITY', false, context);
    this.name = 'SecurityError';
  }

  static RATE_LIMIT_EXCEEDED(key, limit, window) {
    return new SecurityError(
      `Rate limit exceeded for ${key}`,
      'RATE_LIMIT',
      { key, limit, window }
    );
  }

  static BLOCKED_IP(ip, reason) {
    return new SecurityError(
      `Blocked IP: ${ip}`,
      'BLOCKED_IP',
      { ip, reason }
    );
  }

  static INVALID_AUTH(reason) {
    return new SecurityError(
      `Authentication failed: ${reason}`,
      'AUTH_FAILED',
      { reason }
    );
  }

  static SUSPICIOUS_ACTIVITY(type, details) {
    return new SecurityError(
      `Suspicious activity detected: ${type}`,
      'SUSPICIOUS',
      { type, details }
    );
  }
}

/**
 * Resource exhaustion errors
 */
export class ResourceError extends AegirError {
  constructor(message, code = 'RESOURCE_ERROR', context = {}) {
    super(message, code, 'RESOURCE', true, context);
    this.name = 'ResourceError';
  }

  static POOL_EXHAUSTED(poolName, maxSize) {
    return new ResourceError(
      `${poolName} pool exhausted (max: ${maxSize})`,
      'POOL_EXHAUSTED',
      { poolName, maxSize }
    );
  }

  static MEMORY_PRESSURE(level, usage) {
    return new ResourceError(
      `Memory pressure detected: ${level}`,
      'MEM_PRESSURE',
      { level, usage }
    );
  }

  static BUFFER_OVERFLOW(queueSize, maxSize) {
    return new ResourceError(
      `Buffer overflow: queue size ${queueSize} exceeds ${maxSize}`,
      'BUFFER_OVERFLOW',
      { queueSize, maxSize }
    );
  }
}

// ============ ERROR RECOVERY STRATEGIES ============

/**
 * Recovery strategy definitions
 */
export const RecoveryStrategy = {
  RETRY: 'retry',
  FALLBACK: 'fallback',
  DEGRADE: 'degrade',
  ABORT: 'abort',
  IGNORE: 'ignore'
};

/**
 * Determines the appropriate recovery strategy for an error
 * @param {Error} error - The error to analyze
 * @param {Object} context - Additional context for decision making
 * @returns {Object} Recovery strategy recommendation
 */
export function determineRecoveryStrategy(error, context = {}) {
  // Network errors are usually recoverable
  if (error instanceof NetworkError) {
    if (error.code === 'CONN_TIMEOUT' && context.retryCount < 3) {
      return {
        strategy: RecoveryStrategy.RETRY,
        delay: calculateBackoffDelay(context.retryCount),
        maxRetries: 3
      };
    }
    if (error.code === 'DNS_FAILED') {
      return {
        strategy: RecoveryStrategy.FALLBACK,
        fallbackAction: 'use_original_hostname'
      };
    }
    return {
      strategy: RecoveryStrategy.DEGRADE,
      degradeLevel: 'reduced_timeout'
    };
  }

  // Protocol errors are usually not recoverable
  if (error instanceof ProtocolError) {
    return {
      strategy: RecoveryStrategy.ABORT,
      reason: 'Protocol violation cannot be recovered'
    };
  }

  // Configuration errors require abort
  if (error instanceof ConfigurationError) {
    return {
      strategy: RecoveryStrategy.ABORT,
      reason: 'Configuration error requires manual intervention'
    };
  }

  // Security errors should be logged and connection terminated
  if (error instanceof SecurityError) {
    return {
      strategy: RecoveryStrategy.ABORT,
      reason: 'Security violation detected',
      logSecurity: true
    };
  }

  // Resource errors can sometimes be recovered
  if (error instanceof ResourceError) {
    if (error.code === 'POOL_EXHAUSTED') {
      return {
        strategy: RecoveryStrategy.DEGRADE,
        degradeLevel: 'bypass_pool'
      };
    }
    if (error.code === 'MEM_PRESSURE') {
      return {
        strategy: RecoveryStrategy.DEGRADE,
        degradeLevel: 'reduce_throughput'
      };
    }
    return {
      strategy: RecoveryStrategy.RETRY,
      delay: 100,
      maxRetries: 1
    };
  }

  // Default: abort for unknown errors
  return {
    strategy: RecoveryStrategy.ABORT,
    reason: 'Unknown error type'
  };
}

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attempt - Current attempt number
 * @param {Object} options - Backoff options
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoffDelay(attempt, options = {}) {
  const {
    baseDelay = 100,
    maxDelay = 5000,
    multiplier = 2,
    jitterFactor = 0.3
  } = options;

  const exponentialDelay = baseDelay * Math.pow(multiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  const jitter = cappedDelay * jitterFactor * Math.random();
  
  return Math.floor(cappedDelay + jitter);
}

// ============ ERROR HANDLER CLASS ============

/**
 * Centralized error handler with logging, recovery, and metrics
 */
export class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      logErrors: true,
      collectMetrics: true,
      maxErrorHistory: 100,
      ...options
    };
    this.errorHistory = [];
    this.metrics = {
      total: 0,
      byCategory: {},
      byCode: {},
      recovered: 0,
      aborted: 0
    };
  }

  /**
   * Handle an error with automatic recovery attempt
   * @param {Error} error - The error to handle
   * @param {Object} context - Context for recovery decisions
   * @param {Function} retryFn - Function to call for retry recovery
   * @returns {Object} Handling result
   */
  async handle(error, context = {}, retryFn = null) {
    // Record error
    this.recordError(error);

    // Determine strategy
    const strategy = determineRecoveryStrategy(error, context);

    // Execute strategy
    switch (strategy.strategy) {
      case RecoveryStrategy.RETRY:
        if (retryFn && context.retryCount < strategy.maxRetries) {
          await this.delay(strategy.delay);
          try {
            const result = await retryFn();
            this.metrics.recovered++;
            return { success: true, result, strategy: strategy.strategy };
          } catch (retryError) {
            return this.handle(retryError, { ...context, retryCount: (context.retryCount || 0) + 1 }, retryFn);
          }
        }
        break;

      case RecoveryStrategy.FALLBACK:
        this.metrics.recovered++;
        return { success: true, fallback: true, strategy: strategy.strategy, action: strategy.fallbackAction };

      case RecoveryStrategy.DEGRADE:
        this.metrics.recovered++;
        return { success: true, degraded: true, strategy: strategy.strategy, level: strategy.degradeLevel };

      case RecoveryStrategy.ABORT:
        this.metrics.aborted++;
        return { success: false, aborted: true, strategy: strategy.strategy, reason: strategy.reason };

      case RecoveryStrategy.IGNORE:
        return { success: true, ignored: true, strategy: strategy.strategy };
    }

    return { success: false, strategy: strategy.strategy };
  }

  recordError(error) {
    this.metrics.total++;

    // Category metrics
    const category = error.category || 'UNKNOWN';
    this.metrics.byCategory[category] = (this.metrics.byCategory[category] || 0) + 1;

    // Code metrics
    const code = error.code || 'UNKNOWN';
    this.metrics.byCode[code] = (this.metrics.byCode[code] || 0) + 1;

    // Error history (bounded)
    this.errorHistory.push({
      error: error.toJSON ? error.toJSON() : { message: error.message },
      timestamp: Date.now()
    });

    if (this.errorHistory.length > this.options.maxErrorHistory) {
      this.errorHistory.shift();
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   * @returns {Object} Error metrics and recent history
   */
  getStats() {
    return {
      metrics: { ...this.metrics },
      recentErrors: this.errorHistory.slice(-10),
      errorRate: this.calculateErrorRate()
    };
  }

  calculateErrorRate(windowMs = 60000) {
    const now = Date.now();
    const recentErrors = this.errorHistory.filter(e => now - e.timestamp < windowMs);
    return {
      count: recentErrors.length,
      windowMs,
      perMinute: recentErrors.length
    };
  }

  /**
   * Reset metrics and history
   */
  reset() {
    this.errorHistory = [];
    this.metrics = {
      total: 0,
      byCategory: {},
      byCode: {},
      recovered: 0,
      aborted: 0
    };
  }
}

// ============ ERROR BOUNDARIES ============

/**
 * Wraps an async function with error handling
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Wrapper options
 * @returns {Function} Wrapped function
 */
export function withErrorBoundary(fn, options = {}) {
  const handler = new ErrorHandler(options);
  
  return async function(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      const result = await handler.handle(error, options.context);
      if (!result.success) {
        throw error;
      }
      return result;
    }
  };
}

/**
 * Creates a result tuple [error, data] for safer error handling
 * @param {Promise} promise - Promise to wrap
 * @returns {Promise<Array>} [error, data] tuple
 */
export async function safeAwait(promise) {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error, null];
  }
}

// ============ EXPORTS ============

export default {
  AegirError,
  NetworkError,
  ProtocolError,
  ConfigurationError,
  SecurityError,
  ResourceError,
  RecoveryStrategy,
  determineRecoveryStrategy,
  calculateBackoffDelay,
  ErrorHandler,
  withErrorBoundary,
  safeAwait
};
