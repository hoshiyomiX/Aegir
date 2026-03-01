/**
 * Extended Core Module Index
 * Exports all enhanced modules for additional improvements
 * 
 * @module core/index
 * @version 2.0.0
 */

// ============ EXISTING CORE MODULES ============
export * from './state.js';
export * from './diagnostics.js';

// ============ NEW ENHANCED MODULES ============

// Error Handling & Resilience
export * from './errorHandling.js';

// Logging & Observability
export * from './observability.js';

// Security & Validation
export * from './security.js';

// Performance & Throughput
export * from './performance.js';

// Code Quality & Maintainability
export * from './configManager.js';

// ============ INTEGRATION HELPERS ============

import { Logger, MetricsCollector, Tracer, defaultLogger, defaultMetrics } from './observability.js';
import { ErrorHandler, NetworkError, ProtocolError, determineRecoveryStrategy } from './errorHandling.js';
import { RateLimiter, Validator, RequestSecurity, SecurityHeaders } from './security.js';
import { RequestPipeline, AdaptiveThrottler, CacheLayer } from './performance.js';
import { ConfigManager, FeatureFlags, TestUtils } from './configManager.js';

/**
 * Application context that integrates all modules
 */
export class ApplicationContext {
  constructor(options = {}) {
    // Core services
    this.logger = options.logger ?? new Logger(options.logging);
    this.metrics = options.metrics ?? new MetricsCollector(options.metricsConfig);
    this.tracer = new Tracer(options.tracing);
    this.errorHandler = new ErrorHandler(options.errorHandling);
    
    // Security
    this.rateLimiter = new RateLimiter(options.rateLimit);
    this.validator = new Validator();
    this.requestSecurity = new RequestSecurity(options.security);
    
    // Performance
    this.pipeline = new RequestPipeline(options.pipeline);
    this.throttler = new AdaptiveThrottler(options.throttling);
    this.cache = new CacheLayer(options.cache);
    
    // Configuration
    this.config = new ConfigManager(options.configOptions);
    this.features = new FeatureFlags(options.features);
    
    // State
    this.initialized = false;
    this.startTime = Date.now();
  }

  /**
   * Initialize the application context
   */
  async initialize() {
    if (this.initialized) return;

    this.logger.info('Initializing application context');

    // Set up KV cache if available
    if (this.config.get('KV_CACHE')) {
      this.cache.setL2Cache(this.config.get('KV_CACHE'));
    }

    // Configure based on feature flags
    if (this.features.isEnabled('ADVANCED_METRICS')) {
      this.logger.info('Advanced metrics enabled');
    }

    this.initialized = true;
    this.logger.info('Application context initialized');
  }

  /**
   * Handle a request with full integration
   * @param {Request} request - Incoming request
   * @param {Function} handler - Request handler
   * @returns {Response} Response
   */
  async handleRequest(request, handler) {
    const startTime = Date.now();
    const span = this.tracer.startSpan('request');
    span.setAttribute('method', request.method);
    span.setAttribute('url', request.url);

    try {
      // Security check
      const securityCheck = this.requestSecurity.check(request);
      if (!securityCheck.allowed) {
        span.setError(new Error(securityCheck.reason));
        span.end();
        return new Response('Forbidden', { status: 403 });
      }

      // Rate limiting
      const rateCheck = this.rateLimiter.consume(securityCheck.ip);
      if (!rateCheck.allowed) {
        this.metrics.increment('rate_limited', 1, { ip: securityCheck.ip });
        span.end();
        return new Response('Too Many Requests', { 
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfter) }
        });
      }

      // Throttling check
      const throttleCheck = this.throttler.check();
      if (!throttleCheck.allowed) {
        this.metrics.increment('throttled');
        span.end();
        return new Response('Service Unavailable', { 
          status: 503,
          headers: { 'Retry-After': String(Math.ceil(throttleCheck.waitTime / 1000)) }
        });
      }

      // Execute handler
      const response = await handler(request, this);

      // Record metrics
      const duration = Date.now() - startTime;
      this.metrics.histogram('request_duration_ms', duration);
      this.throttler.record(duration, response.status < 500);

      // Apply security headers
      const securedResponse = SecurityHeaders.apply(response);

      span.end();
      return securedResponse;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.throttler.record(duration, false);

      // Error handling
      const handlingResult = await this.errorHandler.handle(error);
      
      this.logger.error('Request failed', error);
      this.metrics.increment('errors', 1, { type: error.constructor.name });
      
      span.setError(error);
      span.end();

      if (handlingResult.recoverable) {
        return new Response('Service Temporarily Unavailable', { status: 503 });
      }
      
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  /**
   * Get comprehensive statistics
   * @returns {Object} All stats
   */
  getStats() {
    return {
      uptime: Date.now() - this.startTime,
      initialized: this.initialized,
      errors: this.errorHandler.getStats(),
      metrics: this.metrics.getMetrics(),
      rateLimiter: this.rateLimiter.getStats(),
      throttler: this.throttler.getStats(),
      cache: this.cache.getStats(),
      pipeline: this.pipeline.getStats(),
      security: this.requestSecurity.getStats(),
      features: this.features.getStats()
    };
  }

  /**
   * Health check endpoint
   * @returns {Object} Health status
   */
  healthCheck() {
    const stats = this.getStats();
    const isHealthy = stats.errors.metrics.aborted < 100 
      && stats.throttler.currentLimit > 10;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      uptime: stats.uptime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info('Shutting down application context');
    
    // Close connections
    this.pipeline.clear();
    
    // Log final stats
    this.logger.info('Final stats', this.getStats());
    
    this.initialized = false;
  }
}

/**
 * Create a default application context
 * @param {Object} options - Configuration options
 * @returns {ApplicationContext} Application context
 */
export function createApp(options = {}) {
  return new ApplicationContext(options);
}

// ============ CONVENIENCE EXPORTS ============

export const createLogger = (options) => new Logger(options);
export const createMetrics = (options) => new MetricsCollector(options);
export const createTracer = (options) => new Tracer(options);
export const createErrorHandler = (options) => new ErrorHandler(options);
export const createRateLimiter = (options) => new RateLimiter(options);
export const createValidator = () => new Validator();
export const createPipeline = (options) => new RequestPipeline(options);
export const createThrottler = (options) => new AdaptiveThrottler(options);
export const createCache = (options) => new CacheLayer(options);
export const createConfig = (options) => new ConfigManager(options);
export const createFeatures = (options) => new FeatureFlags(options);

// ============ DEFAULT EXPORT ============

export default {
  ApplicationContext,
  createApp,
  Logger,
  MetricsCollector,
  Tracer,
  ErrorHandler,
  RateLimiter,
  Validator,
  RequestPipeline,
  AdaptiveThrottler,
  CacheLayer,
  ConfigManager,
  FeatureFlags,
  TestUtils,
  createLogger,
  createMetrics,
  createTracer,
  createErrorHandler,
  createRateLimiter,
  createValidator,
  createPipeline,
  createThrottler,
  createCache,
  createConfig,
  createFeatures
};
