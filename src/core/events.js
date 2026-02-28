/**
 * Event System and Plugin Architecture
 * Improvements: Event-driven architecture, modular plugins, lifecycle hooks,
 * dependency injection, graceful degradation
 */

// ============ EVENT TYPES ============

export const EVENTS = {
  // Connection events
  CONNECTION_OPENED: 'connection:opened',
  CONNECTION_CLOSED: 'connection:closed',
  CONNECTION_ERROR: 'connection:error',
  CONNECTION_TIMEOUT: 'connection:timeout',
  CONNECTION_POOLED: 'connection:pooled',
  CONNECTION_EVICTED: 'connection:evicted',
  
  // Circuit breaker events
  CIRCUIT_OPEN: 'circuit:open',
  CIRCUIT_CLOSE: 'circuit:close',
  CIRCUIT_HALF_OPEN: 'circuit:halfOpen',
  
  // Buffer events
  BACKPRESSURE_START: 'buffer:backpressureStart',
  BACKPRESSURE_END: 'buffer:backpressureEnd',
  BUFFER_OVERFLOW: 'buffer:overflow',
  MEMORY_PRESSURE_CHANGE: 'memory:pressureChange',
  
  // DNS events
  DNS_RESOLVED: 'dns:resolved',
  DNS_CACHE_HIT: 'dns:cacheHit',
  DNS_CACHE_MISS: 'dns:cacheMiss',
  DNS_ERROR: 'dns:error',
  
  // Request events
  REQUEST_START: 'request:start',
  REQUEST_END: 'request:end',
  REQUEST_ERROR: 'request:error',
  REQUEST_RETRY: 'request:retry',
  
  // Protocol events
  PROTOCOL_DETECTED: 'protocol:detected',
  PROTOCOL_ERROR: 'protocol:error',
  
  // System events
  STARTUP: 'system:startup',
  SHUTDOWN: 'system:shutdown',
  HEALTH_CHECK: 'system:healthCheck',
  CONFIG_CHANGE: 'system:configChange'
};

// ============ EVENT EMITTER ============

/**
 * Enhanced event emitter with priority support and async handlers
 */
export class EventEmitter {
  constructor() {
    this.listeners = new Map();
    this.onceListeners = new Map();
    this.stats = {
      emitted: 0,
      handled: 0,
      errors: 0
    };
  }

  /**
   * Subscribe to event
   */
  on(event, handler, options = {}) {
    const priority = options.priority || 0;
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const listeners = this.listeners.get(event);
    listeners.push({ handler, priority, once: false });
    
    // Sort by priority (higher first)
    listeners.sort((a, b) => b.priority - a.priority);
    
    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to event once
   */
  once(event, handler, options = {}) {
    const priority = options.priority || 0;
    
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, []);
    }
    
    const listeners = this.onceListeners.get(event);
    listeners.push({ handler, priority });
    
    listeners.sort((a, b) => b.priority - a.priority);
    
    return () => {
      const idx = listeners.findIndex(l => l.handler === handler);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  /**
   * Unsubscribe from event
   */
  off(event, handler) {
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event);
      const idx = listeners.findIndex(l => l.handler === handler);
      if (idx !== -1) listeners.splice(idx, 1);
    }
    
    if (this.onceListeners.has(event)) {
      const listeners = this.onceListeners.get(event);
      const idx = listeners.findIndex(l => l.handler === handler);
      if (idx !== -1) listeners.splice(idx, 1);
    }
  }

  /**
   * Emit event
   */
  async emit(event, data = {}) {
    this.stats.emitted++;
    
    const eventData = {
      type: event,
      timestamp: Date.now(),
      data,
      preventDefault: false
    };
    
    // Call regular listeners
    if (this.listeners.has(event)) {
      for (const listener of this.listeners.get(event)) {
        try {
          await listener.handler(eventData);
          this.stats.handled++;
        } catch (error) {
          this.stats.errors++;
          console.error(`[EventEmitter] Handler error for ${event}:`, error);
        }
        
        if (eventData.preventDefault) break;
      }
    }
    
    // Call once listeners
    if (this.onceListeners.has(event)) {
      const listeners = this.onceListeners.get(event);
      this.onceListeners.delete(event);
      
      for (const listener of listeners) {
        try {
          await listener.handler(eventData);
          this.stats.handled++;
        } catch (error) {
          this.stats.errors++;
          console.error(`[EventEmitter] Once handler error for ${event}:`, error);
        }
      }
    }
    
    return eventData;
  }

  /**
   * Emit sync (for performance-critical paths)
   */
  emitSync(event, data = {}) {
    this.stats.emitted++;
    
    const eventData = {
      type: event,
      timestamp: Date.now(),
      data,
      preventDefault: false
    };
    
    if (this.listeners.has(event)) {
      for (const listener of this.listeners.get(event)) {
        try {
          listener.handler(eventData);
          this.stats.handled++;
        } catch (error) {
          this.stats.errors++;
        }
      }
    }
    
    return eventData;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      eventTypes: this.listeners.size,
      ...this.stats
    };
  }
}

// ============ PLUGIN SYSTEM ============

/**
 * Plugin interface that all plugins must implement
 */
export class Plugin {
  constructor(name, options = {}) {
    this.name = name;
    this.version = options.version || '1.0.0';
    this.enabled = options.enabled !== false;
    this.priority = options.priority || 0;
    this.dependencies = options.dependencies || [];
    this.config = options.config || {};
    this.eventBus = null;
    this.context = null;
  }

  /**
   * Called when plugin is loaded
   */
  async onLoad(context) {
    this.context = context;
    this.eventBus = context.eventBus;
  }

  /**
   * Called when plugin is enabled
   */
  async onEnable() {
    this.enabled = true;
  }

  /**
   * Called when plugin is disabled
   */
  async onDisable() {
    this.enabled = false;
  }

  /**
   * Called when plugin is unloaded
   */
  async onUnload() {
    this.context = null;
    this.eventBus = null;
  }

  /**
   * Called on system health check
   */
  async healthCheck() {
    return { healthy: true, name: this.name };
  }

  /**
   * Get plugin info
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      enabled: this.enabled,
      priority: this.priority,
      dependencies: this.dependencies
    };
  }
}

/**
 * Plugin Manager
 */
export class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.loadedPlugins = new Set();
    this.eventBus = new EventEmitter();
    this.context = null;
    this.stats = {
      loaded: 0,
      enabled: 0,
      errors: 0
    };
  }

  /**
   * Initialize plugin manager with context
   */
  async initialize(context) {
    this.context = context;
    await this.eventBus.emit(EVENTS.STARTUP, { context });
  }

  /**
   * Register a plugin
   */
  async register(plugin) {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }
    
    // Check dependencies
    for (const dep of plugin.dependencies) {
      if (!this.plugins.has(dep) || !this.plugins.get(dep).enabled) {
        throw new Error(`Plugin ${plugin.name} requires ${dep} which is not available`);
      }
    }
    
    this.plugins.set(plugin.name, plugin);
    
    try {
      await plugin.onLoad(this.context);
      this.loadedPlugins.add(plugin.name);
      this.stats.loaded++;
      
      if (plugin.enabled) {
        await plugin.onEnable();
        this.stats.enabled++;
      }
      
      await this.eventBus.emit('plugin:loaded', { plugin: plugin.name });
      
    } catch (error) {
      this.stats.errors++;
      console.error(`[PluginManager] Failed to load ${plugin.name}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a plugin
   */
  async unregister(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return;
    
    // Check if other plugins depend on this one
    for (const [name, p] of this.plugins) {
      if (p.dependencies.includes(pluginName)) {
        throw new Error(`Cannot unregister ${pluginName}: ${name} depends on it`);
      }
    }
    
    try {
      if (plugin.enabled) {
        await plugin.onDisable();
        this.stats.enabled--;
      }
      
      await plugin.onUnload();
      this.loadedPlugins.delete(pluginName);
      this.plugins.delete(pluginName);
      this.stats.loaded--;
      
      await this.eventBus.emit('plugin:unloaded', { plugin: pluginName });
      
    } catch (error) {
      this.stats.errors++;
      console.error(`[PluginManager] Failed to unload ${pluginName}:`, error);
    }
  }

  /**
   * Enable a plugin
   */
  async enable(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin || plugin.enabled) return;
    
    await plugin.onEnable();
    this.stats.enabled++;
    await this.eventBus.emit('plugin:enabled', { plugin: pluginName });
  }

  /**
   * Disable a plugin
   */
  async disable(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin || !plugin.enabled) return;
    
    await plugin.onDisable();
    this.stats.enabled--;
    await this.eventBus.emit('plugin:disabled', { plugin: pluginName });
  }

  /**
   * Get plugin by name
   */
  getPlugin(name) {
    return this.plugins.get(name);
  }

  /**
   * Get all plugins
   */
  getAllPlugins() {
    return Array.from(this.plugins.values()).map(p => p.getInfo());
  }

  /**
   * Run health checks on all plugins
   */
  async healthCheck() {
    const results = [];
    
    for (const plugin of this.plugins.values()) {
      try {
        const health = await plugin.healthCheck();
        results.push(health);
      } catch (error) {
        results.push({ healthy: false, name: plugin.name, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: this.plugins.size,
      loaded: this.loadedPlugins.size,
      enabled: this.stats.enabled,
      errors: this.stats.errors,
      eventBus: this.eventBus.getStats()
    };
  }
}

// ============ GRACEFUL DEGRADATION ============

/**
 * Degradation levels
 */
export const DEGRADATION_LEVEL = {
  NONE: 'none',           // Full functionality
  MINIMAL: 'minimal',     // Non-essential features disabled
  MODERATE: 'moderate',   // Reduced functionality, cached responses preferred
  SEVERE: 'severe',       // Critical features only, emergency mode
  EMERGENCY: 'emergency'  // Minimal survival mode
};

/**
 * Graceful Degradation Manager
 */
export class DegradationManager {
  constructor() {
    this.currentLevel = DEGRADATION_LEVEL.NONE;
    this.features = new Map();
    this.fallbacks = new Map();
    this.eventBus = new EventEmitter();
    this.stats = {
      degradationEvents: 0,
      fallbackActivations: 0,
      recoveryEvents: 0
    };
    this.healthScore = 100;
    this.healthFactors = new Map();
  }

  /**
   * Register a feature with fallback
   */
  registerFeature(name, options = {}) {
    this.features.set(name, {
      name,
      essential: options.essential || false,
      enabled: true,
      fallback: options.fallback || null,
      degradationLevel: options.degradationLevel || DEGRADATION_LEVEL.MODERATE
    });
    
    if (options.fallback) {
      this.fallbacks.set(name, options.fallback);
    }
  }

  /**
   * Update health factor
   */
  updateHealthFactor(name, score) {
    this.healthFactors.set(name, Math.max(0, Math.min(100, score)));
    this._recalculateHealth();
  }

  /**
   * Recalculate overall health score
   */
  _recalculateHealth() {
    if (this.healthFactors.size === 0) {
      this.healthScore = 100;
      return;
    }
    
    let total = 0;
    for (const score of this.healthFactors.values()) {
      total += score;
    }
    
    this.healthScore = Math.round(total / this.healthFactors.size);
    this._evaluateDegradation();
  }

  /**
   * Evaluate and apply degradation
   */
  _evaluateDegradation() {
    let newLevel = DEGRADATION_LEVEL.NONE;
    
    if (this.healthScore < 20) {
      newLevel = DEGRADATION_LEVEL.EMERGENCY;
    } else if (this.healthScore < 40) {
      newLevel = DEGRADATION_LEVEL.SEVERE;
    } else if (this.healthScore < 60) {
      newLevel = DEGRADATION_LEVEL.MODERATE;
    } else if (this.healthScore < 80) {
      newLevel = DEGRADATION_LEVEL.MINIMAL;
    }
    
    if (newLevel !== this.currentLevel) {
      this._applyDegradation(newLevel);
    }
  }

  /**
   * Apply degradation level
   */
  async _applyDegradation(newLevel) {
    const oldLevel = this.currentLevel;
    this.currentLevel = newLevel;
    this.stats.degradationEvents++;
    
    // Disable features based on degradation level
    for (const [name, feature] of this.features) {
      if (feature.degradationLevel === newLevel && !feature.essential) {
        feature.enabled = false;
        
        // Activate fallback if available
        if (this.fallbacks.has(name)) {
          this.stats.fallbackActivations++;
        }
      }
    }
    
    await this.eventBus.emit('degradation:changed', {
      oldLevel,
      newLevel,
      healthScore: this.healthScore
    });
    
    console.log(`[DegradationManager] Level changed: ${oldLevel} -> ${newLevel} (health: ${this.healthScore})`);
  }

  /**
   * Check if feature is available
   */
  isFeatureAvailable(name) {
    const feature = this.features.get(name);
    return feature ? feature.enabled : false;
  }

  /**
   * Execute with fallback
   */
  async executeWithFallback(name, primaryFn, context = {}) {
    const feature = this.features.get(name);
    
    // If feature is disabled, use fallback
    if (feature && !feature.enabled && this.fallbacks.has(name)) {
      const fallback = this.fallbacks.get(name);
      return await fallback(context);
    }
    
    // Try primary function
    try {
      return await primaryFn(context);
    } catch (error) {
      // On error, try fallback
      if (this.fallbacks.has(name)) {
        console.warn(`[DegradationManager] Primary failed for ${name}, using fallback`);
        this.stats.fallbackActivations++;
        return await this.fallbacks.get(name)(context);
      }
      throw error;
    }
  }

  /**
   * Recover to a better state
   */
  async recover() {
    const previousLevel = this.currentLevel;
    
    if (this.currentLevel !== DEGRADATION_LEVEL.NONE) {
      this.stats.recoveryEvents++;
      
      // Re-enable features
      for (const [name, feature] of this.features) {
        feature.enabled = true;
      }
      
      this.currentLevel = DEGRADATION_LEVEL.NONE;
      this.healthScore = 100;
      
      await this.eventBus.emit('degradation:recovered', {
        previousLevel,
        healthScore: this.healthScore
      });
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      level: this.currentLevel,
      healthScore: this.healthScore,
      features: Array.from(this.features.values()),
      healthFactors: Object.fromEntries(this.healthFactors),
      ...this.stats
    };
  }
}

// ============ DEPENDENCY INJECTION CONTAINER ============

/**
 * Simple DI Container
 */
export class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.factories = new Map();
    this.resolving = new Set(); // Circular dependency detection
  }

  /**
   * Register a service
   */
  register(name, factory, singleton = true) {
    this.factories.set(name, { factory, singleton });
  }

  /**
   * Register a value directly
   */
  registerValue(name, value) {
    this.services.set(name, value);
  }

  /**
   * Resolve a service
   */
  resolve(name) {
    // Check if already resolved as singleton
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }
    
    // Check if registered as value
    if (this.services.has(name)) {
      return this.services.get(name);
    }
    
    // Check for circular dependency
    if (this.resolving.has(name)) {
      throw new Error(`Circular dependency detected: ${name}`);
    }
    
    const registration = this.factories.get(name);
    if (!registration) {
      throw new Error(`Service not found: ${name}`);
    }
    
    this.resolving.add(name);
    
    try {
      const instance = registration.factory(this);
      
      if (registration.singleton) {
        this.singletons.set(name, instance);
      }
      
      this.resolving.delete(name);
      return instance;
      
    } catch (error) {
      this.resolving.delete(name);
      throw error;
    }
  }

  /**
   * Check if service is registered
   */
  has(name) {
    return this.services.has(name) || this.factories.has(name) || this.singletons.has(name);
  }

  /**
   * Clear all services
   */
  clear() {
    this.services.clear();
    this.singletons.clear();
    this.resolving.clear();
  }
}

// ============ APPLICATION CONTEXT ============

/**
 * Application context that holds all services and configuration
 */
export class ApplicationContext {
  constructor() {
    this.container = new ServiceContainer();
    this.pluginManager = new PluginManager();
    this.eventBus = this.pluginManager.eventBus;
    this.degradationManager = new DegradationManager();
    this.config = {};
    this.state = 'initialized';
    this.startTime = Date.now();
    
    // Register core services
    this._registerCoreServices();
  }

  /**
   * Register core services
   */
  _registerCoreServices() {
    this.container.registerValue('eventBus', this.eventBus);
    this.container.registerValue('pluginManager', this.pluginManager);
    this.container.registerValue('degradationManager', this.degradationManager);
    this.container.registerValue('context', this);
  }

  /**
   * Initialize application
   */
  async initialize(config = {}) {
    this.config = config;
    this.state = 'starting';
    
    await this.pluginManager.initialize(this);
    
    this.state = 'running';
    await this.eventBus.emit(EVENTS.STARTUP, { config });
  }

  /**
   * Shutdown application
   */
  async shutdown() {
    this.state = 'stopping';
    
    await this.eventBus.emit(EVENTS.SHUTDOWN, {});
    
    // Unload all plugins
    for (const pluginName of Array.from(this.pluginManager.plugins.keys())) {
      await this.pluginManager.unregister(pluginName);
    }
    
    this.state = 'stopped';
  }

  /**
   * Get service
   */
  getService(name) {
    return this.container.resolve(name);
  }

  /**
   * Register service
   */
  registerService(name, factory, singleton = true) {
    this.container.register(name, factory, singleton);
  }

  /**
   * Get application uptime
   */
  getUptime() {
    return Date.now() - this.startTime;
  }

  /**
   * Get comprehensive status
   */
  getStatus() {
    return {
      state: this.state,
      uptime: this.getUptime(),
      plugins: this.pluginManager.getStats(),
      degradation: this.degradationManager.getStatus(),
      events: this.eventBus.getStats()
    };
  }
}

// ============ SINGLETON INSTANCES ============

export const globalEventBus = new EventEmitter();
export const globalPluginManager = new PluginManager();
export const globalDegradationManager = new DegradationManager();
export const applicationContext = new ApplicationContext();

// ============ EXPORTS ============

export default {
  EVENTS,
  EventEmitter,
  Plugin,
  PluginManager,
  DEGRADATION_LEVEL,
  DegradationManager,
  ServiceContainer,
  ApplicationContext,
  globalEventBus,
  globalPluginManager,
  globalDegradationManager,
  applicationContext
};
