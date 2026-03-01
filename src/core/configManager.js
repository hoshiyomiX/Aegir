/**
 * Code Quality & Maintainability Module
 * Provides configuration management, documentation, and testing utilities
 * 
 * @module core/quality
 * @version 2.0.0
 */

// ============ CONFIGURATION MANAGER ============

/**
 * Hierarchical configuration management with validation
 */
export class ConfigManager {
  constructor(options = {}) {
    this.schema = new Map();
    this.config = new Map();
    this.watchers = new Map();
    this.frozen = false;
    this.history = [];
    this.maxHistory = options.maxHistory ?? 50;
  }

  /**
   * Define a configuration schema
   * @param {string} key - Configuration key
   * @param {Object} schema - Schema definition
   */
  define(key, schema) {
    this.schema.set(key, {
      type: schema.type ?? 'string',
      default: schema.default,
      required: schema.required ?? false,
      validator: schema.validator,
      transform: schema.transform,
      env: schema.env, // Environment variable name
      deprecated: schema.deprecated ?? false,
      description: schema.description ?? '',
      examples: schema.examples ?? []
    });

    // Set default value
    if (schema.default !== undefined) {
      this.config.set(key, schema.default);
    }

    // Load from environment if specified
    if (schema.env && typeof process !== 'undefined' && process.env?.[schema.env]) {
      this.set(key, process.env[schema.env]);
    }
  }

  /**
   * Define multiple configurations at once
   * @param {Object} schemaMap - Schema definitions
   */
  defineAll(schemaMap) {
    for (const [key, schema] of Object.entries(schemaMap)) {
      this.define(key, schema);
    }
  }

  /**
   * Get a configuration value
   * @param {string} key - Configuration key
   * @param {any} defaultValue - Default if not found
   * @returns {any} Configuration value
   */
  get(key, defaultValue = undefined) {
    const schema = this.schema.get(key);
    
    if (this.config.has(key)) {
      const value = this.config.get(key);
      
      // Check deprecation
      if (schema?.deprecated) {
        console.warn(`[Config] '${key}' is deprecated: ${schema.deprecated}`);
      }
      
      return value;
    }

    if (schema?.default !== undefined) {
      return schema.default;
    }

    return defaultValue;
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key
   * @param {any} value - Value to set
   */
  set(key, value) {
    if (this.frozen) {
      throw new Error(`Configuration is frozen, cannot set '${key}'`);
    }

    const schema = this.schema.get(key);
    
    // Validate
    if (schema) {
      const validation = this.validateValue(key, value, schema);
      if (!validation.valid) {
        throw new Error(`Invalid config '${key}': ${validation.error}`);
      }

      // Transform
      if (schema.transform) {
        value = schema.transform(value);
      }
    }

    // Record history
    const oldValue = this.config.get(key);
    this.history.push({
      key,
      oldValue,
      newValue: value,
      timestamp: Date.now()
    });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.config.set(key, value);

    // Notify watchers
    this.notifyWatchers(key, value, oldValue);
  }

  /**
   * Set multiple values at once
   * @param {Object} values - Key-value pairs
   */
  setAll(values) {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value);
    }
  }

  validateValue(key, value, schema) {
    // Required check
    if (schema.required && (value === undefined || value === null)) {
      return { valid: false, error: 'Value is required' };
    }

    // Type check
    if (value !== undefined && value !== null) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (schema.type && actualType !== schema.type) {
        // Try to coerce
        const coerced = this.coerceType(value, schema.type);
        if (coerced === null) {
          return { valid: false, error: `Expected ${schema.type}, got ${actualType}` };
        }
      }
    }

    // Custom validator
    if (schema.validator) {
      const result = schema.validator(value);
      if (result !== true) {
        return { valid: false, error: result || 'Validation failed' };
      }
    }

    return { valid: true };
  }

  coerceType(value, type) {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        const num = Number(value);
        return isNaN(num) ? null : num;
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      default:
        return null;
    }
  }

  /**
   * Watch for configuration changes
   * @param {string} key - Configuration key (or '*' for all)
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  watch(key, callback) {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }
    this.watchers.get(key).add(callback);

    return () => {
      this.watchers.get(key)?.delete(callback);
    };
  }

  notifyWatchers(key, newValue, oldValue) {
    // Notify specific key watchers
    this.watchers.get(key)?.forEach(cb => cb(newValue, oldValue, key));
    
    // Notify global watchers
    this.watchers.get('*')?.forEach(cb => cb(newValue, oldValue, key));
  }

  /**
   * Freeze configuration (prevent further changes)
   */
  freeze() {
    this.frozen = true;
  }

  /**
   * Unfreeze configuration
   */
  unfreeze() {
    this.frozen = false;
  }

  /**
   * Get all configuration as object
   * @returns {Object} Configuration object
   */
  getAll() {
    const result = {};
    for (const [key, schema] of this.schema) {
      result[key] = this.get(key);
    }
    return result;
  }

  /**
   * Get configuration schema documentation
   * @returns {Object} Schema documentation
   */
  getSchemaDocs() {
    const docs = {};
    for (const [key, schema] of this.schema) {
      docs[key] = {
        type: schema.type,
        default: schema.default,
        required: schema.required,
        deprecated: schema.deprecated,
        description: schema.description,
        examples: schema.examples,
        env: schema.env
      };
    }
    return docs;
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.config.clear();
    for (const [key, schema] of this.schema) {
      if (schema.default !== undefined) {
        this.config.set(key, schema.default);
      }
    }
    this.history = [];
  }

  /**
   * Export configuration (for serialization)
   * @returns {Object} Exportable configuration
   */
  export() {
    return {
      config: Object.fromEntries(this.config),
      schema: Object.fromEntries(
        [...this.schema].map(([k, v]) => [k, { ...v, validator: v.validator ? true : undefined }])
      )
    };
  }

  /**
   * Import configuration
   * @param {Object} data - Exported configuration
   */
  import(data) {
    if (data.config) {
      this.setAll(data.config);
    }
  }
}

// ============ FEATURE FLAGS ============

/**
 * Feature flag management with rollout strategies
 */
export class FeatureFlags {
  constructor(options = {}) {
    this.flags = new Map();
    this.context = options.context ?? {};
    this.stats = {
      evaluations: 0,
      enabled: 0,
      disabled: 0
    };
  }

  /**
   * Define a feature flag
   * @param {string} name - Flag name
   * @param {Object} config - Flag configuration
   */
  define(name, config) {
    this.flags.set(name, {
      enabled: config.enabled ?? false,
      rollout: config.rollout ?? 100, // Percentage
      variants: config.variants ?? {},
      conditions: config.conditions ?? [],
      description: config.description ?? ''
    });
  }

  /**
   * Check if a feature is enabled
   * @param {string} name - Flag name
   * @param {Object} context - Evaluation context
   * @returns {boolean} Is enabled
   */
  isEnabled(name, context = {}) {
    this.stats.evaluations++;
    
    const flag = this.flags.get(name);
    if (!flag) {
      return false;
    }

    // Base enabled check
    if (!flag.enabled) {
      this.stats.disabled++;
      return false;
    }

    // Check conditions
    const ctx = { ...this.context, ...context };
    for (const condition of flag.conditions) {
      if (!this.evaluateCondition(condition, ctx)) {
        this.stats.disabled++;
        return false;
      }
    }

    // Rollout percentage
    if (flag.rollout < 100) {
      const hash = this.hashString(name + (ctx.userId ?? ctx.id ?? ''));
      const enabled = (hash % 100) < flag.rollout;
      enabled ? this.stats.enabled++ : this.stats.disabled++;
      return enabled;
    }

    this.stats.enabled++;
    return true;
  }

  /**
   * Get a variant for a feature
   * @param {string} name - Flag name
   * @param {Object} context - Evaluation context
   * @returns {string} Variant name
   */
  getVariant(name, context = {}) {
    const flag = this.flags.get(name);
    if (!flag || !flag.enabled || !Object.keys(flag.variants).length) {
      return 'default';
    }

    const ctx = { ...this.context, ...context };
    const hash = this.hashString(name + (ctx.userId ?? ctx.id ?? ''));
    
    // Weighted variant selection
    const variants = Object.entries(flag.variants);
    const total = variants.reduce((sum, [, w]) => sum + w, 0);
    let target = hash % total;
    
    for (const [variant, weight] of variants) {
      target -= weight;
      if (target < 0) {
        return variant;
      }
    }

    return 'default';
  }

  evaluateCondition(condition, context) {
    const { field, operator, value } = condition;
    const contextValue = context[field];

    switch (operator) {
      case 'eq':
        return contextValue === value;
      case 'ne':
        return contextValue !== value;
      case 'gt':
        return contextValue > value;
      case 'lt':
        return contextValue < value;
      case 'gte':
        return contextValue >= value;
      case 'lte':
        return contextValue <= value;
      case 'in':
        return Array.isArray(value) && value.includes(contextValue);
      case 'nin':
        return Array.isArray(value) && !value.includes(contextValue);
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(value);
      case 'matches':
        return new RegExp(value).test(contextValue);
      default:
        return true;
    }
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Set context for all evaluations
   * @param {Object} context - Context object
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Get all flags and their status
   * @returns {Object} Flags status
   */
  getAll() {
    const result = {};
    for (const [name, flag] of this.flags) {
      result[name] = {
        enabled: flag.enabled,
        rollout: flag.rollout,
        description: flag.description
      };
    }
    return result;
  }

  /**
   * Get statistics
   * @returns {Object} Stats
   */
  getStats() {
    return { ...this.stats };
  }
}

// ============ DOCUMENTATION GENERATOR ============

/**
 * Generate documentation from code annotations
 */
export class DocGenerator {
  constructor() {
    this.modules = new Map();
    this.types = new Map();
  }

  /**
   * Register a module
   * @param {string} name - Module name
   * @param {Object} info - Module information
   */
  registerModule(name, info) {
    this.modules.set(name, {
      name,
      description: info.description ?? '',
      version: info.version ?? '1.0.0',
      exports: info.exports ?? [],
      examples: info.examples ?? []
    });
  }

  /**
   * Register a type
   * @param {string} name - Type name
   * @param {Object} schema - Type schema
   */
  registerType(name, schema) {
    this.types.set(name, schema);
  }

  /**
   * Generate markdown documentation
   * @returns {string} Markdown documentation
   */
  generateMarkdown() {
    const lines = ['# Aegir API Documentation\n'];

    // Table of contents
    lines.push('## Table of Contents\n');
    for (const [name] of this.modules) {
      lines.push(`- [${name}](#${name.toLowerCase()})`);
    }
    lines.push('');

    // Module documentation
    for (const [name, info] of this.modules) {
      lines.push(`## ${name}\n`);
      lines.push(`${info.description}\n`);
      lines.push(`**Version:** ${info.version}\n`);
      
      if (info.exports.length > 0) {
        lines.push('### Exports\n');
        for (const exp of info.exports) {
          lines.push(`#### \`${exp.name}\``);
          if (exp.description) lines.push(`\n${exp.description}`);
          if (exp.params) {
            lines.push('\n**Parameters:**');
            for (const param of exp.params) {
              lines.push(`- \`${param.name}\` (${param.type})${param.optional ? '?' : ''} - ${param.description ?? ''}`);
            }
          }
          if (exp.returns) {
            lines.push(`\n**Returns:** ${exp.returns.type} - ${exp.returns.description ?? ''}`);
          }
          lines.push('');
        }
      }

      if (info.examples.length > 0) {
        lines.push('### Examples\n');
        for (const example of info.examples) {
          lines.push('```javascript');
          lines.push(example);
          lines.push('```\n');
        }
      }
    }

    // Type definitions
    if (this.types.size > 0) {
      lines.push('## Type Definitions\n');
      for (const [name, schema] of this.types) {
        lines.push(`### ${name}\n`);
        lines.push('```typescript');
        lines.push(`interface ${name} {`);
        for (const [field, type] of Object.entries(schema)) {
          lines.push(`  ${field}: ${type};`);
        }
        lines.push('}');
        lines.push('```\n');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate OpenAPI spec
   * @returns {Object} OpenAPI specification
   */
  generateOpenAPI() {
    return {
      openapi: '3.0.0',
      info: {
        title: 'Aegir API',
        version: '2.0.0',
        description: 'Cloudflare Workers proxy server with enhanced network performance'
      },
      paths: {},
      components: {
        schemas: Object.fromEntries(this.types)
      }
    };
  }
}

// ============ TESTING UTILITIES ============

/**
 * Testing utilities for unit and integration tests
 */
export class TestUtils {
  /**
   * Create a mock request
   * @param {Object} options - Request options
   * @returns {Request} Mock request
   */
  static createMockRequest(options = {}) {
    const {
      url = 'https://example.com',
      method = 'GET',
      headers = {},
      body = null,
      cf = {}
    } = options;

    const requestInit = {
      method,
      headers: new Headers(headers)
    };

    if (body) {
      requestInit.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const request = new Request(url, requestInit);
    request.cf = cf;

    return request;
  }

  /**
   * Create a mock environment
   * @param {Object} overrides - Environment overrides
   * @returns {Object} Mock environment
   */
  static createMockEnv(overrides = {}) {
    return {
      KV_CACHE: {
        get: async () => null,
        put: async () => {},
        delete: async () => {}
      },
      ...overrides
    };
  }

  /**
   * Wait for a condition
   * @param {Function} condition - Condition function
   * @param {Object} options - Wait options
   * @returns {Promise} Resolves when condition is true
   */
  static async waitFor(condition, options = {}) {
    const { timeout = 5000, interval = 100 } = options;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Timeout waiting for condition');
  }

  /**
   * Measure execution time
   * @param {Function} fn - Function to measure
   * @returns {Object} { result, duration }
   */
  static async measure(fn) {
    const start = Date.now();
    const result = await fn();
    return { result, duration: Date.now() - start };
  }

  /**
   * Run a test with retries
   * @param {Function} testFn - Test function
   * @param {Object} options - Retry options
   * @returns {any} Test result
   */
  static async retry(testFn, options = {}) {
    const { attempts = 3, delay = 100 } = options;
    let lastError;

    for (let i = 0; i < attempts; i++) {
      try {
        return await testFn();
      } catch (error) {
        lastError = error;
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }

    throw lastError;
  }

  /**
   * Generate random test data
   * @param {string} type - Data type
   * @param {Object} options - Generation options
   * @returns {any} Generated data
   */
  static generate(type, options = {}) {
    switch (type) {
      case 'ip':
        return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
      
      case 'port':
        return Math.floor(Math.random() * 65535) + 1;
      
      case 'uuid':
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      
      case 'string':
        const length = options.length ?? 10;
        return Math.random().toString(36).substring(2, length + 2);
      
      case 'email':
        return `test${Math.random().toString(36).substring(7)}@example.com`;
      
      case 'buffer':
        const size = options.size ?? 1024;
        return new Uint8Array(size).map(() => Math.floor(Math.random() * 256));
      
      default:
        return null;
    }
  }
}

// ============ DEFAULT INSTANCES ============

export const defaultConfig = new ConfigManager();
export const defaultFeatureFlags = new FeatureFlags();
export const defaultDocGenerator = new DocGenerator();

// Define default configuration schema
defaultConfig.defineAll({
  LOG_LEVEL: {
    type: 'string',
    default: 'INFO',
    env: 'LOG_LEVEL',
    description: 'Logging level',
    validator: v => ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'].includes(v) || 'Invalid log level'
  },
  MAX_CONNECTIONS: {
    type: 'number',
    default: 100,
    env: 'MAX_CONNECTIONS',
    description: 'Maximum concurrent connections',
    validator: v => v > 0 || 'Must be positive'
  },
  TIMEOUT_MS: {
    type: 'number',
    default: 30000,
    env: 'TIMEOUT_MS',
    description: 'Default timeout in milliseconds',
    validator: v => v >= 1000 || 'Minimum 1000ms'
  },
  ENABLE_METRICS: {
    type: 'boolean',
    default: true,
    env: 'ENABLE_METRICS',
    description: 'Enable metrics collection'
  },
  RATE_LIMIT_RPM: {
    type: 'number',
    default: 100,
    env: 'RATE_LIMIT_RPM',
    description: 'Rate limit requests per minute'
  }
});

// Define default feature flags
defaultFeatureFlags.define('ADVANCED_METRICS', {
  enabled: true,
  rollout: 100,
  description: 'Advanced metrics collection with percentiles'
});

defaultFeatureFlags.define('EXPERIMENTAL_COMPRESSION', {
  enabled: false,
  rollout: 10,
  description: 'Experimental Brotli compression'
});

defaultFeatureFlags.define('ADAPTIVE_THROTTLING', {
  enabled: true,
  rollout: 100,
  description: 'Adaptive request throttling based on latency'
});

// ============ EXPORTS ============

export default {
  ConfigManager,
  FeatureFlags,
  DocGenerator,
  TestUtils,
  defaultConfig,
  defaultFeatureFlags,
  defaultDocGenerator
};
