/**
 * Logging & Observability Module
 * Provides structured logging, metrics collection, and tracing support
 * 
 * @module core/observability
 * @version 2.0.0
 */

// ============ LOG LEVELS ============

export const LogLevel = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
  NONE: 100
};

export const LogLevelNames = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

// ============ STRUCTURED LOGGER ============

/**
 * Structured logger with multiple output formats and filtering
 */
export class Logger {
  constructor(options = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '[Aegir]';
    this.includeTimestamp = options.includeTimestamp ?? true;
    this.includeLevel = options.includeLevel ?? true;
    this.jsonFormat = options.jsonFormat ?? false;
    this.sensitiveFields = options.sensitiveFields ?? ['password', 'token', 'secret', 'key', 'auth'];
    this.context = options.context ?? {};
    this.handlers = options.handlers ?? [];
  }

  /**
   * Create a child logger with additional context
   * @param {Object} additionalContext - Context to add
   * @returns {Logger} Child logger
   */
  child(additionalContext = {}) {
    return new Logger({
      ...this.options,
      prefix: this.prefix,
      context: { ...this.context, ...additionalContext }
    });
  }

  /**
   * Log a trace message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  trace(message, data = {}) {
    this.log(LogLevel.TRACE, message, data);
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  debug(message, data = {}) {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  warn(message, data = {}) {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {Error|Object} error - Error object or data
   */
  error(message, error = {}) {
    const data = error instanceof Error 
      ? { error: error.message, stack: error.stack, name: error.name }
      : error;
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Log a fatal message
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  fatal(message, data = {}) {
    this.log(LogLevel.FATAL, message, data);
  }

  /**
   * Core logging method
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    if (level < this.level) return;

    const sanitizedData = this.sanitize(data);
    const logEntry = this.createLogEntry(level, message, sanitizedData);

    // Output to console
    this.outputToConsole(level, logEntry);

    // Call custom handlers
    for (const handler of this.handlers) {
      try {
        handler(logEntry);
      } catch (err) {
        console.error('Log handler error:', err);
      }
    }
  }

  createLogEntry(level, message, data) {
    const entry = {
      message,
      level,
      levelName: LogLevelNames[level],
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data
    };

    return entry;
  }

  outputToConsole(level, entry) {
    if (this.jsonFormat) {
      const output = JSON.stringify(entry);
      this.getConsoleMethod(level)(output);
    } else {
      const parts = [];
      if (this.includeTimestamp) parts.push(entry.timestamp);
      if (this.includeLevel) parts.push(`[${entry.levelName}]`);
      parts.push(this.prefix);
      parts.push(entry.message);

      const prefix = parts.join(' ');
      const dataStr = Object.keys(entry).length > 4 ? this.formatData(entry) : '';

      this.getConsoleMethod(level)(prefix, dataStr);
    }
  }

  getConsoleMethod(level) {
    if (level >= LogLevel.ERROR) return console.error;
    if (level >= LogLevel.WARN) return console.warn;
    return console.log;
  }

  formatData(entry) {
    const filtered = { ...entry };
    delete filtered.message;
    delete filtered.level;
    delete filtered.levelName;
    delete filtered.timestamp;
    
    if (Object.keys(filtered).length === 0) return '';
    return JSON.stringify(filtered, null, 0);
  }

  /**
   * Sanitize sensitive data from log entries
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitize(data) {
    if (typeof data !== 'object' || data === null) return data;

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Time a function execution
   * @param {string} label - Timer label
   * @param {Function} fn - Function to time
   * @returns {any} Function result
   */
  async time(label, fn) {
    const start = Date.now();
    this.debug(`${label}: started`);
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug(`${label}: completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${label}: failed after ${duration}ms`, error);
      throw error;
    }
  }

  /**
   * Create a timer that logs on stop
   * @param {string} label - Timer label
   * @returns {Object} Timer object with stop method
   */
  startTimer(label) {
    const start = Date.now();
    return {
      stop: (additionalData = {}) => {
        const duration = Date.now() - start;
        this.debug(`${label}: ${duration}ms`, additionalData);
        return duration;
      }
    };
  }
}

// ============ METRICS COLLECTOR ============

/**
 * Metrics collection and aggregation system
 */
export class MetricsCollector {
  constructor(options = {}) {
    this.prefix = options.prefix ?? 'aegir';
    this.labels = options.labels ?? {};
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.timers = new Map();
    this.maxHistorySize = options.maxHistorySize ?? 1000;
  }

  /**
   * Increment a counter
   * @param {string} name - Counter name
   * @param {number} value - Value to add
   * @param {Object} labels - Additional labels
   */
  increment(name, value = 1, labels = {}) {
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) || { name, value: 0, labels };
    current.value += value;
    this.counters.set(key, current);
  }

  /**
   * Decrement a counter
   * @param {string} name - Counter name
   * @param {number} value - Value to subtract
   * @param {Object} labels - Additional labels
   */
  decrement(name, value = 1, labels = {}) {
    this.increment(name, -value, labels);
  }

  /**
   * Set a gauge value
   * @param {string} name - Gauge name
   * @param {number} value - Value to set
   * @param {Object} labels - Additional labels
   */
  gauge(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, { name, value, labels, timestamp: Date.now() });
  }

  /**
   * Record a histogram value
   * @param {string} name - Histogram name
   * @param {number} value - Value to record
   * @param {Object} labels - Additional labels
   */
  histogram(name, value, labels = {}) {
    const key = this.getMetricKey(name, labels);
    const current = this.histograms.get(key) || { 
      name, 
      values: [], 
      count: 0, 
      sum: 0, 
      min: Infinity, 
      max: -Infinity,
      labels 
    };

    current.values.push(value);
    current.count++;
    current.sum += value;
    current.min = Math.min(current.min, value);
    current.max = Math.max(current.max, value);

    // Trim history if too large
    if (current.values.length > this.maxHistorySize) {
      current.values = current.values.slice(-this.maxHistorySize);
    }

    this.histograms.set(key, current);
  }

  /**
   * Time an operation
   * @param {string} name - Timer name
   * @param {Object} labels - Additional labels
   * @returns {Object} Timer object with stop method
   */
  startTimer(name, labels = {}) {
    const start = Date.now();
    return {
      stop: (additionalLabels = {}) => {
        const duration = Date.now() - start;
        this.histogram(`${name}_duration_ms`, duration, { ...labels, ...additionalLabels });
        return duration;
      }
    };
  }

  /**
   * Time an async function
   * @param {string} name - Timer name
   * @param {Function} fn - Async function to time
   * @param {Object} labels - Additional labels
   * @returns {any} Function result
   */
  async timeAsync(name, fn, labels = {}) {
    const timer = this.startTimer(name, labels);
    try {
      const result = await fn();
      timer.stop({ status: 'success' });
      return result;
    } catch (error) {
      timer.stop({ status: 'error' });
      throw error;
    }
  }

  /**
   * Get metric key with labels
   * @param {string} name - Metric name
   * @param {Object} labels - Labels
   * @returns {string} Metric key
   */
  getMetricKey(name, labels = {}) {
    const allLabels = { ...this.labels, ...labels };
    const labelStr = Object.entries(allLabels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Get histogram statistics
   * @param {string} name - Histogram name
   * @param {Object} labels - Labels
   * @returns {Object} Statistics
   */
  getHistogramStats(name, labels = {}) {
    const key = this.getMetricKey(name, labels);
    const histogram = this.histograms.get(key);
    
    if (!histogram || histogram.count === 0) {
      return { count: 0, sum: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...histogram.values].sort((a, b) => a - b);
    
    return {
      count: histogram.count,
      sum: histogram.sum,
      min: histogram.min,
      max: histogram.max,
      avg: histogram.sum / histogram.count,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    };
  }

  percentile(sortedArray, p) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Get all metrics in Prometheus format
   * @returns {string} Prometheus formatted metrics
   */
  getPrometheusMetrics() {
    const lines = [];
    
    // Counters
    for (const [key, metric] of this.counters) {
      lines.push(`# TYPE ${metric.name} counter`);
      lines.push(`${key} ${metric.value}`);
    }
    
    // Gauges
    for (const [key, metric] of this.gauges) {
      lines.push(`# TYPE ${metric.name} gauge`);
      lines.push(`${key} ${metric.value}`);
    }
    
    // Histograms
    for (const [key, metric] of this.histograms) {
      lines.push(`# TYPE ${metric.name} histogram`);
      const stats = this.getHistogramStats(metric.name, metric.labels);
      lines.push(`${metric.name}_count ${stats.count}`);
      lines.push(`${metric.name}_sum ${stats.sum}`);
      lines.push(`${metric.name}_min ${stats.min}`);
      lines.push(`${metric.name}_max ${stats.max}`);
    }

    return lines.join('\n');
  }

  /**
   * Get all metrics as JSON
   * @returns {Object} Metrics object
   */
  getMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        [...this.histograms].map(([key, h]) => [key, this.getHistogramStats(h.name, h.labels)])
      )
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
  }
}

// ============ TRACING ============

/**
 * Distributed tracing support
 */
export class Tracer {
  constructor(options = {}) {
    this.serviceName = options.serviceName ?? 'aegir';
    this.sampleRate = options.sampleRate ?? 1.0;
    this.spans = new Map();
    this.maxSpans = options.maxSpans ?? 1000;
  }

  /**
   * Start a new span
   * @param {string} name - Span name
   * @param {Object} options - Span options
   * @returns {Object} Span object
   */
  startSpan(name, options = {}) {
    const spanId = this.generateId();
    const traceId = options.traceId ?? this.generateId();
    const parentSpanId = options.parentSpanId ?? null;

    const span = {
      traceId,
      spanId,
      parentSpanId,
      name,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      status: 'OK',
      attributes: options.attributes ?? {},
      events: [],
      shouldSample: Math.random() < this.sampleRate
    };

    if (span.shouldSample) {
      this.spans.set(spanId, span);
      this.trimSpans();
    }

    return {
      spanId,
      traceId,
      addEvent: (name, attributes = {}) => {
        if (span.shouldSample) {
          span.events.push({ name, timestamp: Date.now(), attributes });
        }
      },
      setAttribute: (key, value) => {
        if (span.shouldSample) {
          span.attributes[key] = value;
        }
      },
      setError: (error) => {
        if (span.shouldSample) {
          span.status = 'ERROR';
          span.attributes['error.type'] = error.name ?? 'Error';
          span.attributes['error.message'] = error.message ?? String(error);
        }
      },
      end: () => {
        if (span.shouldSample) {
          span.endTime = Date.now();
          span.duration = span.endTime - span.startTime;
        }
      }
    };
  }

  /**
   * Start a child span
   * @param {string} name - Span name
   * @param {Object} parent - Parent span
   * @param {Object} options - Span options
   * @returns {Object} Child span
   */
  startChildSpan(name, parent, options = {}) {
    return this.startSpan(name, {
      ...options,
      traceId: parent.traceId,
      parentSpanId: parent.spanId
    });
  }

  /**
   * Trace an async function
   * @param {string} name - Span name
   * @param {Function} fn - Async function
   * @param {Object} options - Span options
   * @returns {any} Function result
   */
  async trace(name, fn, options = {}) {
    const span = this.startSpan(name, options);
    try {
      const result = await fn(span);
      return result;
    } catch (error) {
      span.setError(error);
      throw error;
    } finally {
      span.end();
    }
  }

  generateId() {
    return Math.random().toString(36).substring(2, 18);
  }

  trimSpans() {
    if (this.spans.size > this.maxSpans) {
      const entries = [...this.spans.entries()];
      const toRemove = entries.slice(0, entries.length - this.maxSpans);
      for (const [id] of toRemove) {
        this.spans.delete(id);
      }
    }
  }

  /**
   * Get completed spans for export
   * @returns {Array} Completed spans
   */
  getCompletedSpans() {
    return [...this.spans.values()]
      .filter(s => s.endTime !== null)
      .map(s => ({ ...s }));
  }

  /**
   * Export spans in OTLP format
   * @returns {Object} OTLP formatted spans
   */
  exportOTLP() {
    return {
      resourceSpans: [{
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: this.serviceName } }]
        },
        scopeSpans: [{
          spans: this.getCompletedSpans().map(span => ({
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId,
            name: span.name,
            startTimeUnixNano: span.startTime * 1e6,
            endTimeUnixNano: span.endTime * 1e6,
            status: { code: span.status === 'OK' ? 1 : 2 },
            attributes: Object.entries(span.attributes).map(([k, v]) => ({
              key: k,
              value: { stringValue: String(v) }
            }))
          }))
        }]
      }]
    };
  }
}

// ============ HEALTH CHECK ============

/**
 * Health check system for monitoring
 */
export class HealthChecker {
  constructor() {
    this.checks = new Map();
    this.lastResult = null;
    this.lastCheckTime = null;
  }

  /**
   * Register a health check
   * @param {string} name - Check name
   * @param {Function} checkFn - Check function that returns { healthy, message }
   * @param {Object} options - Check options
   */
  register(name, checkFn, options = {}) {
    this.checks.set(name, {
      name,
      check: checkFn,
      critical: options.critical ?? false,
      timeout: options.timeout ?? 5000,
      interval: options.interval ?? 30000
    });
  }

  /**
   * Run all health checks
   * @returns {Object} Health check result
   */
  async check() {
    const results = {};
    const startTime = Date.now();

    for (const [name, checkDef] of this.checks) {
      try {
        const result = await Promise.race([
          checkDef.check(),
          this.timeout(checkDef.timeout)
        ]);
        results[name] = {
          ...result,
          critical: checkDef.critical
        };
      } catch (error) {
        results[name] = {
          healthy: false,
          message: error.message ?? 'Health check failed',
          critical: checkDef.critical
        };
      }
    }

    const allHealthy = Object.values(results).every(r => r.healthy);
    const criticalHealthy = Object.values(results)
      .filter(r => r.critical)
      .every(r => r.healthy);

    this.lastResult = {
      status: allHealthy ? 'healthy' : (criticalHealthy ? 'degraded' : 'unhealthy'),
      checks: results,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    };
    this.lastCheckTime = Date.now();

    return this.lastResult;
  }

  timeout(ms) {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), ms)
    );
  }

  /**
   * Get last health check result
   * @returns {Object} Last result
   */
  getLastResult() {
    return this.lastResult;
  }
}

// ============ DEFAULT INSTANCES ============

export const defaultLogger = new Logger({ level: LogLevel.INFO });
export const defaultMetrics = new MetricsCollector();
export const defaultTracer = new Tracer();
export const defaultHealthChecker = new HealthChecker();

// ============ EXPORTS ============

export default {
  LogLevel,
  Logger,
  MetricsCollector,
  Tracer,
  HealthChecker,
  defaultLogger,
  defaultMetrics,
  defaultTracer,
  defaultHealthChecker
};
