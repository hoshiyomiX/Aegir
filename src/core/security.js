/**
 * Security & Validation Module
 * Provides input validation, rate limiting, and security utilities
 * 
 * @module core/security
 * @version 2.0.0
 */

// ============ RATE LIMITING ============

/**
 * Token bucket rate limiter
 */
export class RateLimiter {
  constructor(options = {}) {
    this.tokensPerInterval = options.tokensPerInterval ?? 100;
    this.interval = options.interval ?? 60000; // 1 minute
    this.maxTokens = options.maxTokens ?? this.tokensPerInterval;
    this.tokens = new Map();
    this.lastRefill = new Map();
    this.maxEntries = options.maxEntries ?? 10000;
    this.strategy = options.strategy ?? 'token_bucket'; // 'token_bucket', 'sliding_window', 'fixed_window'
    this.requests = new Map(); // For sliding window
    this.whitelist = new Set(options.whitelist ?? []);
    this.blacklist = new Set(options.blacklist ?? []);
  }

  /**
   * Check if a request should be allowed
   * @param {string} key - Unique identifier (e.g., IP address)
   * @param {number} cost - Token cost of the request
   * @returns {Object} { allowed, remaining, resetTime, retryAfter }
   */
  consume(key, cost = 1) {
    // Check whitelist
    if (this.whitelist.has(key)) {
      return { allowed: true, remaining: this.maxTokens, resetTime: null, retryAfter: 0 };
    }

    // Check blacklist
    if (this.blacklist.has(key)) {
      return { allowed: false, remaining: 0, resetTime: null, retryAfter: -1, reason: 'blacklisted' };
    }

    const now = Date.now();

    switch (this.strategy) {
      case 'token_bucket':
        return this.tokenBucketCheck(key, cost, now);
      case 'sliding_window':
        return this.slidingWindowCheck(key, cost, now);
      case 'fixed_window':
        return this.fixedWindowCheck(key, cost, now);
      default:
        return this.tokenBucketCheck(key, cost, now);
    }
  }

  tokenBucketCheck(key, cost, now) {
    this.refillTokens(key, now);
    
    const currentTokens = this.tokens.get(key) ?? this.tokensPerInterval;
    
    if (currentTokens >= cost) {
      this.tokens.set(key, currentTokens - cost);
      return {
        allowed: true,
        remaining: currentTokens - cost,
        resetTime: now + this.interval,
        retryAfter: 0
      };
    }

    const timeUntilRefill = this.interval - (now - (this.lastRefill.get(key) ?? now));
    return {
      allowed: false,
      remaining: 0,
      resetTime: now + timeUntilRefill,
      retryAfter: Math.ceil(timeUntilRefill / 1000)
    };
  }

  slidingWindowCheck(key, cost, now) {
    const windowStart = now - this.interval;
    let requests = this.requests.get(key) ?? [];
    
    // Filter out old requests
    requests = requests.filter(t => t > windowStart);
    
    if (requests.length + cost <= this.tokensPerInterval) {
      // Add new request timestamps
      for (let i = 0; i < cost; i++) {
        requests.push(now);
      }
      this.requests.set(key, requests);
      
      return {
        allowed: true,
        remaining: this.tokensPerInterval - requests.length,
        resetTime: now + this.interval,
        retryAfter: 0
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetTime: requests[0] + this.interval,
      retryAfter: Math.ceil((requests[0] + this.interval - now) / 1000)
    };
  }

  fixedWindowCheck(key, cost, now) {
    const windowKey = Math.floor(now / this.interval);
    const fullKey = `${key}:${windowKey}`;
    
    let currentCount = this.tokens.get(fullKey) ?? 0;
    
    if (currentCount + cost <= this.tokensPerInterval) {
      this.tokens.set(fullKey, currentCount + cost);
      
      return {
        allowed: true,
        remaining: this.tokensPerInterval - currentCount - cost,
        resetTime: (windowKey + 1) * this.interval,
        retryAfter: 0
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetTime: (windowKey + 1) * this.interval,
      retryAfter: Math.ceil(((windowKey + 1) * this.interval - now) / 1000)
    };
  }

  refillTokens(key, now) {
    const lastRefillTime = this.lastRefill.get(key) ?? now;
    const timePassed = now - lastRefillTime;
    
    if (timePassed >= this.interval) {
      const intervalsPassed = Math.floor(timePassed / this.interval);
      const tokensToAdd = intervalsPassed * this.tokensPerInterval;
      const currentTokens = this.tokens.get(key) ?? 0;
      
      this.tokens.set(key, Math.min(currentTokens + tokensToAdd, this.maxTokens));
      this.lastRefill.set(key, now);
      
      this.trimEntries();
    }
  }

  trimEntries() {
    if (this.tokens.size > this.maxEntries) {
      const entries = [...this.tokens.entries()];
      const toRemove = entries.slice(0, Math.floor(this.maxEntries * 0.2));
      for (const [key] of toRemove) {
        this.tokens.delete(key);
        this.lastRefill.delete(key);
      }
    }
  }

  /**
   * Add key to whitelist
   * @param {string} key - Key to whitelist
   */
  addToWhitelist(key) {
    this.whitelist.add(key);
    this.blacklist.delete(key);
  }

  /**
   * Add key to blacklist
   * @param {string} key - Key to blacklist
   */
  addToBlacklist(key) {
    this.blacklist.add(key);
    this.whitelist.delete(key);
    this.tokens.delete(key);
    this.lastRefill.delete(key);
    this.requests.delete(key);
  }

  /**
   * Remove key from both lists
   * @param {string} key - Key to remove
   */
  remove(key) {
    this.whitelist.delete(key);
    this.blacklist.delete(key);
    this.tokens.delete(key);
    this.lastRefill.delete(key);
    this.requests.delete(key);
  }

  /**
   * Get current stats
   * @returns {Object} Rate limiter stats
   */
  getStats() {
    return {
      activeKeys: this.tokens.size,
      whitelistSize: this.whitelist.size,
      blacklistSize: this.blacklist.size,
      strategy: this.strategy,
      tokensPerInterval: this.tokensPerInterval,
      interval: this.interval,
      maxTokens: this.maxTokens
    };
  }
}

// ============ INPUT VALIDATION ============

/**
 * Input validation utilities
 */
export class Validator {
  constructor() {
    this.rules = new Map();
    this.customValidators = new Map();
  }

  /**
   * Register a custom validator
   * @param {string} name - Validator name
   * @param {Function} validator - Validator function
   */
  register(name, validator) {
    this.customValidators.set(name, validator);
  }

  /**
   * Validate an object against a schema
   * @param {Object} data - Data to validate
   * @param {Object} schema - Validation schema
   * @returns {Object} { valid, errors, sanitized }
   */
  validate(data, schema) {
    const errors = [];
    const sanitized = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const result = this.validateField(field, value, rules);
      
      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }
      
      if (result.value !== undefined) {
        sanitized[field] = result.value;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }

  validateField(field, value, rules) {
    const errors = [];
    let sanitizedValue = value;

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, rule: 'required', message: `${field} is required` });
      return { errors, value: undefined };
    }

    // Skip further validation if optional and empty
    if (!rules.required && (value === undefined || value === null || value === '')) {
      return { errors, value: rules.default };
    }

    // Type validation
    if (rules.type) {
      const typeResult = this.validateType(field, value, rules.type);
      if (typeResult.error) {
        errors.push(typeResult.error);
      } else {
        sanitizedValue = typeResult.value;
      }
    }

    // String validations
    if (typeof sanitizedValue === 'string') {
      if (rules.minLength && sanitizedValue.length < rules.minLength) {
        errors.push({ field, rule: 'minLength', message: `${field} must be at least ${rules.minLength} characters` });
      }
      if (rules.maxLength && sanitizedValue.length > rules.maxLength) {
        errors.push({ field, rule: 'maxLength', message: `${field} must be at most ${rules.maxLength} characters` });
      }
      if (rules.pattern && !rules.pattern.test(sanitizedValue)) {
        errors.push({ field, rule: 'pattern', message: `${field} format is invalid` });
      }
      if (rules.enum && !rules.enum.includes(sanitizedValue)) {
        errors.push({ field, rule: 'enum', message: `${field} must be one of: ${rules.enum.join(', ')}` });
      }
    }

    // Number validations
    if (typeof sanitizedValue === 'number') {
      if (rules.min !== undefined && sanitizedValue < rules.min) {
        errors.push({ field, rule: 'min', message: `${field} must be at least ${rules.min}` });
      }
      if (rules.max !== undefined && sanitizedValue > rules.max) {
        errors.push({ field, rule: 'max', message: `${field} must be at most ${rules.max}` });
      }
      if (rules.integer && !Number.isInteger(sanitizedValue)) {
        errors.push({ field, rule: 'integer', message: `${field} must be an integer` });
      }
    }

    // Array validations
    if (Array.isArray(sanitizedValue)) {
      if (rules.minItems && sanitizedValue.length < rules.minItems) {
        errors.push({ field, rule: 'minItems', message: `${field} must have at least ${rules.minItems} items` });
      }
      if (rules.maxItems && sanitizedValue.length > rules.maxItems) {
        errors.push({ field, rule: 'maxItems', message: `${field} must have at most ${rules.maxItems} items` });
      }
    }

    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(sanitizedValue);
      if (customResult !== true) {
        errors.push({ field, rule: 'custom', message: customResult || `${field} failed custom validation` });
      }
    }

    // Sanitization
    if (rules.sanitize) {
      sanitizedValue = this.sanitizeValue(sanitizedValue, rules.sanitize);
    }

    return { errors, value: sanitizedValue };
  }

  validateType(field, value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string' 
          ? { value }
          : { error: { field, rule: 'type', message: `${field} must be a string` } };
      
      case 'number':
        const num = Number(value);
        return !isNaN(num) 
          ? { value: num }
          : { error: { field, rule: 'type', message: `${field} must be a number` } };
      
      case 'boolean':
        if (typeof value === 'boolean') return { value };
        if (value === 'true' || value === '1') return { value: true };
        if (value === 'false' || value === '0') return { value: false };
        return { error: { field, rule: 'type', message: `${field} must be a boolean` } };
      
      case 'array':
        return Array.isArray(value) 
          ? { value }
          : { error: { field, rule: 'type', message: `${field} must be an array` } };
      
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
          ? { value }
          : { error: { field, rule: 'type', message: `${field} must be an object` } };
      
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value)
          ? { value: value.toLowerCase() }
          : { error: { field, rule: 'type', message: `${field} must be a valid email` } };
      
      case 'url':
        try {
          new URL(value);
          return { value };
        } catch {
          return { error: { field, rule: 'type', message: `${field} must be a valid URL` } };
        }
      
      case 'ip':
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/;
        return ipRegex.test(value)
          ? { value }
          : { error: { field, rule: 'type', message: `${field} must be a valid IP address` } };
      
      case 'port':
        const port = Number(value);
        return Number.isInteger(port) && port >= 1 && port <= 65535
          ? { value: port }
          : { error: { field, rule: 'type', message: `${field} must be a valid port (1-65535)` } };
      
      case 'uuid':
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value)
          ? { value: value.toLowerCase() }
          : { error: { field, rule: 'type', message: `${field} must be a valid UUID` } };
      
      default:
        return { value };
    }
  }

  sanitizeValue(value, sanitizeType) {
    if (typeof value !== 'string') return value;

    switch (sanitizeType) {
      case 'trim':
        return value.trim();
      case 'lowercase':
        return value.toLowerCase();
      case 'uppercase':
        return value.toUpperCase();
      case 'alphanumeric':
        return value.replace(/[^a-zA-Z0-9]/g, '');
      case 'numeric':
        return value.replace(/[^0-9]/g, '');
      case 'escapeHtml':
        return value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');
      case 'stripHtml':
        return value.replace(/<[^>]*>/g, '');
      case 'noSqlInjection':
        return value.replace(/[$.{}[\]:;,=+\-*!@#%^&()~`|\\]/g, '');
      default:
        return value;
    }
  }
}

// ============ SECURITY HEADERS ============

/**
 * Security headers configuration
 */
export const SecurityHeaders = {
  /**
   * Get recommended security headers
   * @param {Object} options - Header options
   * @returns {Object} Headers object
   */
  getDefault(options = {}) {
    const {
      frameOptions = 'DENY',
      contentTypeOptions = 'nosniff',
      xssProtection = '1; mode=block',
      hsts = 'max-age=31536000; includeSubDomains; preload',
      csp = null,
      referrerPolicy = 'strict-origin-when-cross-origin',
      permissionsPolicy = 'geolocation=(), microphone=(), camera=()'
    } = options;

    const headers = {
      'X-Content-Type-Options': contentTypeOptions,
      'X-Frame-Options': frameOptions,
      'X-XSS-Protection': xssProtection,
      'Referrer-Policy': referrerPolicy,
      'Permissions-Policy': permissionsPolicy
    };

    if (hsts) {
      headers['Strict-Transport-Security'] = hsts;
    }

    if (csp) {
      headers['Content-Security-Policy'] = csp;
    }

    return headers;
  },

  /**
   * Apply security headers to a response
   * @param {Response} response - Response object
   * @param {Object} headers - Headers to apply
   * @returns {Response} Modified response
   */
  apply(response, headers = null) {
    const securityHeaders = headers ?? this.getDefault();
    const newHeaders = new Headers(response.headers);

    for (const [key, value] of Object.entries(securityHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};

// ============ IP UTILITIES ============

/**
 * IP address utilities
 */
export const IPUtils = {
  /**
   * Check if IP is private/internal
   * @param {string} ip - IP address
   * @returns {boolean} True if private
   */
  isPrivate(ip) {
    const privateRanges = [
      /^10\./,                    // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./,              // 192.168.0.0/16
      /^127\./,                   // 127.0.0.0/8 (loopback)
      /^169\.254\./,              // 169.254.0.0/16 (link-local)
      /^0\.0\.0\.0$/,             // 0.0.0.0
      /^::1$/,                    // IPv6 loopback
      /^fc00:/i,                  // IPv6 unique local
      /^fe80:/i                   // IPv6 link-local
    ];

    return privateRanges.some(regex => regex.test(ip));
  },

  /**
   * Check if IP is IPv6
   * @param {string} ip - IP address
   * @returns {boolean} True if IPv6
   */
  isIPv6(ip) {
    return ip.includes(':');
  },

  /**
   * Extract IP from request
   * @param {Request} request - Request object
   * @returns {string} IP address
   */
  extractIP(request) {
    // Check Cloudflare headers first
    const cfIP = request.headers.get('cf-connecting-ip');
    if (cfIP) return cfIP;

    // Check X-Forwarded-For
    const xff = request.headers.get('x-forwarded-for');
    if (xff) {
      const ips = xff.split(',').map(ip => ip.trim());
      return ips[0]; // First IP is the original client
    }

    // Check X-Real-IP
    const realIP = request.headers.get('x-real-ip');
    if (realIP) return realIP;

    return 'unknown';
  },

  /**
   * Anonymize IP for logging (GDPR compliance)
   * @param {string} ip - IP address
   * @returns {string} Anonymized IP
   */
  anonymize(ip) {
    if (this.isIPv6(ip)) {
      // Zero out last 64 bits
      const parts = ip.split(':');
      return [...parts.slice(0, 4), '0', '0', '0', '0'].join(':');
    } else {
      // Zero out last octet
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
  }
};

// ============ REQUEST SECURITY ============

/**
 * Request security utilities
 */
export class RequestSecurity {
  constructor(options = {}) {
    this.rateLimiter = new RateLimiter(options.rateLimit);
    this.validator = new Validator();
    this.blockedIPs = new Set();
    this.suspiciousIPs = new Map();
    this.maxSuspiciousScore = options.maxSuspiciousScore ?? 10;
  }

  /**
   * Check request for security issues
   * @param {Request} request - Request to check
   * @returns {Object} Security check result
   */
  check(request) {
    const ip = IPUtils.extractIP(request);
    const issues = [];
    let suspiciousScore = 0;

    // Check if IP is blocked
    if (this.blockedIPs.has(ip)) {
      return {
        allowed: false,
        reason: 'IP blocked',
        ip: IPUtils.anonymize(ip)
      };
    }

    // Rate limiting
    const rateCheck = this.rateLimiter.consume(ip);
    if (!rateCheck.allowed) {
      suspiciousScore += 3;
      issues.push({ type: 'rate_limit', details: rateCheck });
    }

    // Check for suspicious headers
    const headerIssues = this.checkHeaders(request);
    issues.push(...headerIssues);
    suspiciousScore += headerIssues.length;

    // Check for suspicious path
    const pathIssues = this.checkPath(request);
    issues.push(...pathIssues);
    suspiciousScore += pathIssues.length * 2;

    // Update suspicious score
    const currentScore = (this.suspiciousIPs.get(ip) ?? 0) + suspiciousScore;
    this.suspiciousIPs.set(ip, currentScore);

    // Auto-block if score too high
    if (currentScore >= this.maxSuspiciousScore) {
      this.blockedIPs.add(ip);
      return {
        allowed: false,
        reason: 'Auto-blocked: suspicious activity',
        ip: IPUtils.anonymize(ip),
        suspiciousScore: currentScore
      };
    }

    return {
      allowed: true,
      ip: IPUtils.anonymize(ip),
      issues: issues.length > 0 ? issues : undefined,
      rateLimit: rateCheck,
      suspiciousScore: currentScore
    };
  }

  checkHeaders(request) {
    const issues = [];
    const suspiciousHeaders = [
      'x-forwarded-host',
      'x-original-url',
      'x-rewrite-url',
      'x-host'
    ];

    for (const header of suspiciousHeaders) {
      if (request.headers.get(header)) {
        issues.push({ type: 'suspicious_header', header });
      }
    }

    // Check User-Agent
    const ua = request.headers.get('user-agent') ?? '';
    const suspiciousUAPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
      /zgrab/i,
      /curl/i,
      /wget/i,
      /python-requests/i,
      /go-http-client/i
    ];

    for (const pattern of suspiciousUAPatterns) {
      if (pattern.test(ua)) {
        issues.push({ type: 'suspicious_ua', pattern: pattern.source });
        break;
      }
    }

    return issues;
  }

  checkPath(request) {
    const issues = [];
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();
    const query = url.search.toLowerCase();

    const suspiciousPatterns = [
      /\.\./,           // Path traversal
      /\/etc\//,        // System files
      /\/proc\//,       // System files
      /%00/,            // Null byte
      /%2e%2e/,         // Encoded path traversal
      /union.*select/i, // SQL injection
      /<script/i,       // XSS
      /javascript:/i,   // XSS
      /onerror=/i,      // XSS
      /eval\(/i,        // Code injection
      /exec\(/i,        // Code injection
    ];

    const fullPath = path + query;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fullPath)) {
        issues.push({ type: 'suspicious_path', pattern: pattern.source });
      }
    }

    return issues;
  }

  /**
   * Get security statistics
   * @returns {Object} Security stats
   */
  getStats() {
    return {
      rateLimiter: this.rateLimiter.getStats(),
      blockedIPs: this.blockedIPs.size,
      suspiciousIPs: this.suspiciousIPs.size
    };
  }
}

// ============ DEFAULT INSTANCES ============

export const defaultValidator = new Validator();
export const defaultRateLimiter = new RateLimiter();
export const defaultRequestSecurity = new RequestSecurity();

// ============ EXPORTS ============

export default {
  RateLimiter,
  Validator,
  SecurityHeaders,
  IPUtils,
  RequestSecurity,
  defaultValidator,
  defaultRateLimiter,
  defaultRequestSecurity
};
