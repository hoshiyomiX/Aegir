/**
 * Service Container for Dependency Injection
 * 
 * Features:
 * - Service registration and resolution
 * - Lifecycle management (singleton, transient, scoped)
 * - Configuration injection
 * - Service factories
 */

// Service lifecycles
export const SERVICE_LIFECYCLE = {
  SINGLETON: 'SINGLETON',     // One instance for entire application
  TRANSIENT: 'TRANSIENT',     // New instance every request
  SCOPED: 'SCOPED'           // One instance per scope
};

/**
 * Service Registration
 */
class ServiceRegistration {
  constructor(name, factory, options = {}) {
    this.name = name;
    this.factory = factory;
    this.lifecycle = options.lifecycle || SERVICE_LIFECYCLE.SINGLETON;
    this.dependencies = options.dependencies || [];
    this.instance = null;
    this.isInitializing = false;
    this.configKey = options.configKey || null;
  }
}

/**
 * Service Container
 */
export class ServiceContainer {
  constructor() {
    this.registrations = new Map();
    this.scopes = new Map();
    this.config = {};
    this.initialized = false;
    this.stats = {
      resolutions: 0,
      singletonHits: 0,
      transientCreates: 0,
      scopeCreations: 0
    };
  }
  
  /**
   * Set configuration
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Register a service
   */
  register(name, factory, options = {}) {
    const registration = new ServiceRegistration(name, factory, options);
    this.registrations.set(name, registration);
    return this;
  }
  
  /**
   * Register a singleton service
   */
  singleton(name, factory, options = {}) {
    return this.register(name, factory, { ...options, lifecycle: SERVICE_LIFECYCLE.SINGLETON });
  }
  
  /**
   * Register a transient service
   */
  transient(name, factory, options = {}) {
    return this.register(name, factory, { ...options, lifecycle: SERVICE_LIFECYCLE.TRANSIENT });
  }
  
  /**
   * Register a scoped service
   */
  scoped(name, factory, options = {}) {
    return this.register(name, factory, { ...options, lifecycle: SERVICE_LIFECYCLE.SCOPED });
  }
  
  /**
   * Register an existing instance
   */
  instance(name, instance) {
    this.registrations.set(name, {
      name,
      instance,
      lifecycle: SERVICE_LIFECYCLE.SINGLETON,
      dependencies: []
    });
    return this;
  }
  
  /**
   * Resolve a service
   */
  resolve(name, scopeId = null) {
    this.stats.resolutions++;
    
    const registration = this.registrations.get(name);
    
    if (!registration) {
      throw new Error(`Service not registered: ${name}`);
    }
    
    // Return existing instance if singleton and already created
    if (registration.lifecycle === SERVICE_LIFECYCLE.SINGLETON && registration.instance) {
      this.stats.singletonHits++;
      return registration.instance;
    }
    
    // Handle scoped services
    if (registration.lifecycle === SERVICE_LIFECYCLE.SCOPED && scopeId) {
      const scope = this.scopes.get(scopeId);
      if (scope && scope.has(name)) {
        return scope.get(name);
      }
    }
    
    // Detect circular dependencies
    if (registration.isInitializing) {
      throw new Error(`Circular dependency detected: ${name}`);
    }
    
    // Create new instance
    return this.createInstance(registration, scopeId);
  }
  
  /**
   * Create a new service instance
   */
  createInstance(registration, scopeId = null) {
    registration.isInitializing = true;
    
    try {
      // Resolve dependencies
      const deps = {};
      for (const depName of registration.dependencies) {
        deps[depName] = this.resolve(depName, scopeId);
      }
      
      // Get config if needed
      let serviceConfig = {};
      if (registration.configKey && this.config[registration.configKey]) {
        serviceConfig = this.config[registration.configKey];
      }
      
      // Create instance
      const instance = registration.factory(deps, serviceConfig);
      
      // Store based on lifecycle
      if (registration.lifecycle === SERVICE_LIFECYCLE.SINGLETON) {
        registration.instance = instance;
      } else if (registration.lifecycle === SERVICE_LIFECYCLE.SCOPED && scopeId) {
        if (!this.scopes.has(scopeId)) {
          this.scopes.set(scopeId, new Map());
          this.stats.scopeCreations++;
        }
        this.scopes.get(scopeId).set(name, instance);
      } else {
        this.stats.transientCreates++;
      }
      
      return instance;
    } finally {
      registration.isInitializing = false;
    }
  }
  
  /**
   * Create a new scope
   */
  createScope() {
    const scopeId = `scope_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scopes.set(scopeId, new Map());
    return scopeId;
  }
  
  /**
   * Dispose a scope
   */
  disposeScope(scopeId) {
    const scope = this.scopes.get(scopeId);
    if (scope) {
      // Call dispose on instances that have it
      for (const instance of scope.values()) {
        if (typeof instance.dispose === 'function') {
          instance.dispose();
        }
      }
      this.scopes.delete(scopeId);
    }
  }
  
  /**
   * Check if service is registered
   */
  has(name) {
    return this.registrations.has(name);
  }
  
  /**
   * Get all registered service names
   */
  getRegisteredServices() {
    return Array.from(this.registrations.keys());
  }
  
  /**
   * Initialize all singletons
   */
  async initialize() {
    if (this.initialized) return;
    
    for (const [name, registration] of this.registrations) {
      if (registration.lifecycle === SERVICE_LIFECYCLE.SINGLETON && !registration.instance) {
        this.resolve(name);
      }
    }
    
    this.initialized = true;
  }
  
  /**
   * Dispose all services
   */
  dispose() {
    for (const registration of this.registrations.values()) {
      if (registration.instance && typeof registration.instance.dispose === 'function') {
        registration.instance.dispose();
      }
    }
    
    for (const scopeId of this.scopes.keys()) {
      this.disposeScope(scopeId);
    }
    
    this.initialized = false;
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      registeredServices: this.registrations.size,
      activeScopes: this.scopes.size,
      initialized: this.initialized
    };
  }
}

/**
 * Application Context - Central configuration and service management
 */
export class ApplicationContext {
  constructor() {
    this.container = new ServiceContainer();
    this.state = {
      isInitialized: false,
      startTime: null,
      requestCount: 0,
      errorCount: 0
    };
    this.hooks = {
      beforeRequest: [],
      afterRequest: [],
      onError: [],
      onShutdown: []
    };
  }
  
  /**
   * Configure the application
   */
  configure(config) {
    this.container.setConfig(config);
    return this;
  }
  
  /**
   * Register core services
   */
  registerCoreServices() {
    // Register circuit breaker
    this.container.singleton('circuitBreakerManager', () => {
      const { circuitBreakerManager } = require('./circuitBreaker.js');
      return circuitBreakerManager;
    });
    
    // Register connection manager
    this.container.singleton('connectionManager', () => {
      const { connectionManager } = require('./connectionManager.js');
      return connectionManager;
    });
    
    // Register buffer manager
    this.container.singleton('bufferManager', () => {
      const { bufferManager } = require('./bufferManager.js');
      return bufferManager;
    });
    
    // Register DNS manager
    this.container.singleton('dnsManager', () => {
      const { dnsManager } = require('./dnsManager.js');
      return dnsManager;
    });
    
    // Register error aggregator
    this.container.singleton('errorAggregator', () => {
      const { errorAggregator } = require('./errorHandler.js');
      return errorAggregator;
    });
    
    return this;
  }
  
  /**
   * Add a hook
   */
  addHook(event, fn) {
    if (this.hooks[event]) {
      this.hooks[event].push(fn);
    }
    return this;
  }
  
  /**
   * Execute hooks
   */
  async executeHooks(event, context) {
    if (this.hooks[event]) {
      for (const fn of this.hooks[event]) {
        await fn(context);
      }
    }
  }
  
  /**
   * Initialize the application
   */
  async initialize() {
    if (this.state.isInitialized) return;
    
    await this.container.initialize();
    this.state.isInitialized = true;
    this.state.startTime = Date.now();
    
    return this;
  }
  
  /**
   * Create a request context
   */
  createRequestContext(request, env) {
    this.state.requestCount++;
    
    const scopeId = this.container.createScope();
    
    return {
      scopeId,
      request,
      env,
      container: this.container,
      startTime: Date.now(),
      services: {}
    };
  }
  
  /**
   * Complete a request
   */
  async completeRequest(ctx) {
    const duration = Date.now() - ctx.startTime;
    
    await this.executeHooks('afterRequest', { ctx, duration });
    
    this.container.disposeScope(ctx.scopeId);
  }
  
  /**
   * Handle an error
   */
  async handleError(ctx, error) {
    this.state.errorCount++;
    
    await this.executeHooks('onError', { ctx, error });
    
    const errorAggregator = this.container.resolve('errorAggregator');
    if (errorAggregator) {
      errorAggregator.record(error);
    }
  }
  
  /**
   * Shutdown the application
   */
  async shutdown() {
    await this.executeHooks('onShutdown', {});
    
    this.container.dispose();
    this.state.isInitialized = false;
  }
  
  /**
   * Get application status
   */
  getStatus() {
    return {
      isInitialized: this.state.isInitialized,
      uptime: this.state.startTime ? Date.now() - this.state.startTime : 0,
      requestCount: this.state.requestCount,
      errorCount: this.state.errorCount,
      services: this.container.getStats()
    };
  }
}

// Global application context
export const appContext = new ApplicationContext();

export default {
  ServiceContainer,
  ApplicationContext,
  appContext,
  SERVICE_LIFECYCLE
};
