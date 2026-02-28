/**
 * Enhanced Error Handler with Error Boundaries
 * 
 * Features:
 * - Categorized error types
 * - Error recovery strategies
 * - Error aggregation and reporting
 * - Graceful degradation
 */

// Error categories
export const ERROR_CATEGORY = {
  NETWORK: 'NETWORK',
  PROTOCOL: 'PROTOCOL',
  TIMEOUT: 'TIMEOUT',
  DNS: 'DNS',
  MEMORY: 'MEMORY',
  VALIDATION: 'VALIDATION',
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN'
};

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'LOW',           // Minor issue, automatic recovery
  MEDIUM: 'MEDIUM',     // Moderate issue, may need intervention
  HIGH: 'HIGH',         // Serious issue, service degraded
  CRITICAL: 'CRITICAL'  // Service unavailable
};

// Recovery strategies
export const RECOVERY_STRATEGY = {
  RETRY: 'RETRY',
  FALLBACK: 'FALLBACK',
  CIRCUIT_BREAK: 'CIRCUIT_BREAK',
  GRACEFUL_DEGRADE: 'GRACEFUL_DEGRADE',
  TERMINATE: 'TERMINATE'
};

/**
 * Base Application Error
 */
export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.category = options.category || ERROR_CATEGORY.UNKNOWN;
    this.severity = options.severity || ERROR_SEVERITY.MEDIUM;
    this.recovery = options.recovery || RECOVERY_STRATEGY.GRACEFUL_DEGRADE;
    this.context = options.context || {};
    this.timestamp = Date.now();
    this.isRecoverable = options.isRecoverable !== false;
    this.retryCount = options.retryCount || 0;
    this.maxRetries = options.maxRetries || 3;
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Check if error should be retried
   */
  shouldRetry() {
    return this.isRecoverable && 
           this.recovery === RECOVERY_STRATEGY.RETRY && 
           this.retryCount < this.maxRetries;
  }
  
  /**
   * Create a retry version of this error
   */
  createRetryError() {
    return new this.constructor(this.message, {
      ...this,
      retryCount: this.retryCount + 1
    });
  }
  
  /**
   * Convert to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      severity: this.severity,
      recovery: this.recovery,
      context: this.context,
      timestamp: this.timestamp,
      isRecoverable: this.isRecoverable,
      retryCount: this.retryCount,
      stack: this.stack
    };
  }
}

/**
 * Network Error
 */
export class NetworkError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      category: ERROR_CATEGORY.NETWORK,
      severity: options.severity || ERROR_SEVERITY.MEDIUM,
      recovery: options.recovery || RECOVERY_STRATEGY.RETRY,
      ...options
    });
    this.name = 'NetworkError';
    this.address = options.address;
    this.port = options.port;
  }
}

/**
 * Protocol Error
 */
export class ProtocolError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      category: ERROR_CATEGORY.PROTOCOL,
      severity: options.severity || ERROR_SEVERITY.HIGH,
      recovery: options.recovery || RECOVERY_STRATEGY.TERMINATE,
      isRecoverable: false,
      ...options
    });
    this.name = 'ProtocolError';
    this.protocol = options.protocol;
  }
}

/**
 * Timeout Error
 */
export class TimeoutError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      category: ERROR_CATEGORY.TIMEOUT,
      severity: options.severity || ERROR_SEVERITY.MEDIUM,
      recovery: options.recovery || RECOVERY_STRATEGY.RETRY,
      ...options
    });
    this.name = 'TimeoutError';
    this.timeout = options.timeout;
    this.operation = options.operation;
  }
}

/**
 * DNS Error
 */
export class DNSError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      category: ERROR_CATEGORY.DNS,
      severity: options.severity || ERROR_SEVERITY.MEDIUM,
      recovery: options.recovery || RECOVERY_STRATEGY.FALLBACK,
      ...options
    });
    this.name = 'DNSError';
    this.hostname = options.hostname;
  }
}

/**
 * Memory Pressure Error
 */
export class MemoryError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      category: ERROR_CATEGORY.MEMORY,
      severity: options.severity || ERROR_SEVERITY.HIGH,
      recovery: options.recovery || RECOVERY_STRATEGY.GRACEFUL_DEGRADE,
      ...options
    });
    this.name = 'MemoryError';
    this.pressureLevel = options.pressureLevel;
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(message, options = {}) {
    super(message, {
      category: ERROR_CATEGORY.VALIDATION,
      severity: options.severity || ERROR_SEVERITY.LOW,
      recovery: options.recovery || RECOVERY_STRATEGY.TERMINATE,
      isRecoverable: false,
      ...options
    });
    this.name = 'ValidationError';
    this.field = options.field;
    this.value = options.value;
  }
}

/**
 * Error Boundary - Catches and handles errors in a controlled manner
 */
export class ErrorBoundary {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.onError = options.onError || (() => {});
    this.onRecovery = options.onRecovery || (() => {});
    this.fallback = options.fallback || null;
    
    this.stats = {
      totalErrors: 0,
      recoveredErrors: 0,
      unrecoveredErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: {}
    };
  }
  
  /**
   * Execute function within error boundary
   */
  async execute(fn, context = {}) {
    try {
      const result = await fn();
      return { success: true, result };
    } catch (error) {
      const appError = this.normalizeError(error, context);
      this.recordError(appError);
      
      // Notify error handler
      this.onError(appError);
      
      // Attempt recovery
      if (appError.isRecoverable) {
        const recovered = await this.attemptRecovery(appError);
        if (recovered) {
          this.stats.recoveredErrors++;
          this.onRecovery(appError);
          return { success: true, result: recovered, recovered: true };
        }
      }
      
      this.stats.unrecoveredErrors++;
      
      // Use fallback if available
      if (this.fallback) {
        return { success: true, result: this.fallback(appError), fallback: true };
      }
      
      return { success: false, error: appError };
    }
  }
  
  /**
   * Normalize any error to AppError
   */
  normalizeError(error, context = {}) {
    if (error instanceof AppError) {
      error.context = { ...error.context, ...context };
      return error;
    }
    
    // Classify common errors
    let category = ERROR_CATEGORY.UNKNOWN;
    let severity = ERROR_SEVERITY.MEDIUM;
    let recovery = RECOVERY_STRATEGY.GRACEFUL_DEGRADE;
    
    const message = error.message || String(error);
    
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      category = ERROR_CATEGORY.TIMEOUT;
      recovery = RECOVERY_STRATEGY.RETRY;
    } else if (message.includes('ECONNREFUSED') || message.includes('ECONNRESET')) {
      category = ERROR_CATEGORY.NETWORK;
      recovery = RECOVERY_STRATEGY.RETRY;
    } else if (message.includes('ENOTFOUND') || message.includes('DNS')) {
      category = ERROR_CATEGORY.DNS;
      recovery = RECOVERY_STRATEGY.FALLBACK;
    } else if (message.includes('memory') || message.includes('heap')) {
      category = ERROR_CATEGORY.MEMORY;
      severity = ERROR_SEVERITY.HIGH;
    }
    
    return new AppError(message, {
      category,
      severity,
      recovery,
      context,
      originalError: error
    });
  }
  
  /**
   * Attempt to recover from error
   */
  async attemptRecovery(error) {
    switch (error.recovery) {
      case RECOVERY_STRATEGY.RETRY:
        if (error.shouldRetry()) {
          const retryError = error.createRetryError();
          // Caller should handle the actual retry
          return { shouldRetry: true, retryError };
        }
        return null;
        
      case RECOVERY_STRATEGY.FALLBACK:
        // Return a safe default
        return { fallback: true };
        
      case RECOVERY_STRATEGY.GRACEFUL_DEGRADE:
        // Return partial functionality
        return { degraded: true };
        
      case RECOVERY_STRATEGY.CIRCUIT_BREAK:
        // Signal that circuit should open
        return { circuitBreak: true };
        
      case RECOVERY_STRATEGY.TERMINATE:
      default:
        return null;
    }
  }
  
  /**
   * Record error statistics
   */
  recordError(error) {
    this.stats.totalErrors++;
    
    // Count by category
    if (!this.stats.errorsByCategory[error.category]) {
      this.stats.errorsByCategory[error.category] = 0;
    }
    this.stats.errorsByCategory[error.category]++;
    
    // Count by severity
    if (!this.stats.errorsBySeverity[error.severity]) {
      this.stats.errorsBySeverity[error.severity] = 0;
    }
    this.stats.errorsBySeverity[error.severity]++;
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      name: this.name,
      ...this.stats,
      recoveryRate: this.stats.totalErrors > 0
        ? (this.stats.recoveredErrors / this.stats.totalErrors * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

/**
 * Error Aggregator - Collects and analyzes errors across boundaries
 */
export class ErrorAggregator {
  constructor() {
    this.errors = [];
    this.maxSize = 100;
    this.alertThresholds = {
      [ERROR_SEVERITY.HIGH]: 5,      // Alert after 5 high severity errors
      [ERROR_SEVERITY.CRITICAL]: 1    // Alert immediately on critical
    };
  }
  
  /**
   * Record error
   */
  record(error) {
    this.errors.push({
      timestamp: Date.now(),
      error: error.toJSON ? error.toJSON() : error
    });
    
    // Trim old errors
    if (this.errors.length > this.maxSize) {
      this.errors.shift();
    }
    
    // Check thresholds
    return this.checkThresholds();
  }
  
  /**
   * Check if alert thresholds are exceeded
   */
  checkThresholds() {
    const recentErrors = this.getRecentErrors(60000); // Last minute
    
    const alerts = [];
    
    for (const [severity, threshold] of Object.entries(this.alertThresholds)) {
      const count = recentErrors.filter(e => 
        e.error.severity === severity
      ).length;
      
      if (count >= threshold) {
        alerts.push({
          severity,
          count,
          threshold,
          message: `${severity} severity errors (${count}) exceeded threshold (${threshold})`
        });
      }
    }
    
    return alerts;
  }
  
  /**
   * Get recent errors
   */
  getRecentErrors(windowMs = 60000) {
    const cutoff = Date.now() - windowMs;
    return this.errors.filter(e => e.timestamp > cutoff);
  }
  
  /**
   * Get error summary
   */
  getSummary() {
    const recent = this.getRecentErrors();
    
    const byCategory = {};
    const bySeverity = {};
    
    for (const e of recent) {
      const cat = e.error.category || 'UNKNOWN';
      const sev = e.error.severity || 'MEDIUM';
      
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }
    
    return {
      total: this.errors.length,
      recent: recent.length,
      byCategory,
      bySeverity
    };
  }
  
  /**
   * Clear old errors
   */
  cleanup(maxAge = 3600000) {
    const cutoff = Date.now() - maxAge;
    this.errors = this.errors.filter(e => e.timestamp > cutoff);
  }
}

// Global error aggregator
export const errorAggregator = new ErrorAggregator();

export default {
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
};
