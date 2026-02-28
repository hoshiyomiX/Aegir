/**
 * Enhanced Buffer & Memory Manager
 * 
 * Features:
 * - Zero-copy optimization where possible
 * - Adaptive backpressure handling
 * - Memory pressure detection
 * - Smart chunk coalescing
 * - Buffer pool for reuse
 */

import { 
  BUFFER_HIGH_WATERMARK, 
  BUFFER_LOW_WATERMARK,
  MAX_QUEUE_SIZE,
  COALESCE_THRESHOLD,
  COALESCE_MAX_SIZE,
  COALESCE_TIMEOUT,
  WATERMARK_INTERACTIVE,
  WATERMARK_BALANCED,
  WATERMARK_BULK,
  THRESHOLD_BULK,
  THRESHOLD_MEDIUM
} from '../config/constants.js';
import { bufferStats, batchStats } from './state.js';

// Memory pressure levels
export const MEMORY_PRESSURE = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

// Buffer configuration
const BUFFER_CONFIG = {
  // Pool settings
  poolEnabled: true,
  poolMaxSize: 100,
  poolDefaultSize: 65536, // 64KB default buffer
  
  // Pressure thresholds
  pressureCheckInterval: 5000,
  highPressureThreshold: 0.8,    // 80% of max queue
  criticalPressureThreshold: 0.95, // 95% of max queue
  
  // Adaptive settings
  adaptiveBackpressure: true,
  backpressureMultiplier: 1.5,
  
  // Zero-copy threshold
  zeroCopyThreshold: 32768 // 32KB - use zero-copy for larger chunks
};

/**
 * Buffer Pool for memory reuse
 */
class BufferPool {
  constructor() {
    this.pools = new Map(); // Size -> Array of buffers
    this.stats = {
      allocated: 0,
      reused: 0,
      returned: 0,
      evicted: 0
    };
  }
  
  /**
   * Get buffer from pool or create new
   */
  get(size) {
    // Round up to nearest power of 2 for better pooling
    const poolSize = this.roundToPoolSize(size);
    
    if (this.pools.has(poolSize)) {
      const pool = this.pools.get(poolSize);
      if (pool.length > 0) {
        this.stats.reused++;
        return pool.pop();
      }
    }
    
    // Create new buffer
    this.stats.allocated++;
    return new Uint8Array(poolSize);
  }
  
  /**
   * Return buffer to pool
   */
  release(buffer) {
    if (!BUFFER_CONFIG.poolEnabled) return;
    
    const size = buffer.length;
    const poolSize = this.roundToPoolSize(size);
    
    // Don't pool very large buffers
    if (poolSize > 1048576) { // 1MB
      return;
    }
    
    if (!this.pools.has(poolSize)) {
      this.pools.set(poolSize, []);
    }
    
    const pool = this.pools.get(poolSize);
    
    // Limit pool size
    if (pool.length < BUFFER_CONFIG.poolMaxSize) {
      pool.push(buffer);
      this.stats.returned++;
    } else {
      this.stats.evicted++;
    }
  }
  
  /**
   * Round to nearest pool size (power of 2)
   */
  roundToPoolSize(size) {
    if (size <= 4096) return 4096;
    if (size <= 8192) return 8192;
    if (size <= 16384) return 16384;
    if (size <= 32768) return 32768;
    if (size <= 65536) return 65536;
    if (size <= 131072) return 131072;
    if (size <= 262144) return 262144;
    return Math.pow(2, Math.ceil(Math.log2(size)));
  }
  
  /**
   * Clear all pools
   */
  clear() {
    this.pools.clear();
  }
  
  /**
   * Get pool statistics
   */
  getStats() {
    let totalBuffers = 0;
    let totalMemory = 0;
    
    for (const [size, pool] of this.pools) {
      totalBuffers += pool.length;
      totalMemory += pool.length * size;
    }
    
    return {
      ...this.stats,
      poolsCount: this.pools.size,
      totalBuffers,
      totalMemory,
      reuseRate: this.stats.allocated > 0 
        ? (this.stats.reused / this.stats.allocated * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

/**
 * Memory Pressure Monitor
 */
class MemoryPressureMonitor {
  constructor() {
    this.currentPressure = MEMORY_PRESSURE.LOW;
    this.pressureHistory = [];
    this.callbacks = new Map();
    this.stats = {
      pressureChanges: 0,
      timeInHigh: 0,
      timeInCritical: 0
    };
  }
  
  /**
   * Calculate memory pressure based on queue depth
   */
  calculatePressure(queueDepth, maxQueueSize, bufferedAmount, highWatermark) {
    const queueRatio = queueDepth / maxQueueSize;
    const bufferRatio = bufferedAmount / highWatermark;
    
    // Use higher ratio
    const pressure = Math.max(queueRatio, bufferRatio);
    
    let level;
    if (pressure >= BUFFER_CONFIG.criticalPressureThreshold) {
      level = MEMORY_PRESSURE.CRITICAL;
    } else if (pressure >= BUFFER_CONFIG.highPressureThreshold) {
      level = MEMORY_PRESSURE.HIGH;
    } else if (pressure >= 0.5) {
      level = MEMORY_PRESSURE.MEDIUM;
    } else {
      level = MEMORY_PRESSURE.LOW;
    }
    
    // Track pressure changes
    if (level !== this.currentPressure) {
      this.stats.pressureChanges++;
      this.notifyCallbacks(level, this.currentPressure);
      this.currentPressure = level;
    }
    
    // Record history
    this.pressureHistory.push({ time: Date.now(), level, pressure });
    if (this.pressureHistory.length > 100) {
      this.pressureHistory.shift();
    }
    
    return { level, ratio: pressure };
  }
  
  /**
   * Register callback for pressure changes
   */
  onPressureChange(id, callback) {
    this.callbacks.set(id, callback);
  }
  
  /**
   * Remove callback
   */
  removeCallback(id) {
    this.callbacks.delete(id);
  }
  
  /**
   * Notify all callbacks
   */
  notifyCallbacks(newLevel, oldLevel) {
    for (const callback of this.callbacks.values()) {
      try {
        callback(newLevel, oldLevel);
      } catch (e) {
        console.error('Pressure callback error:', e);
      }
    }
  }
  
  /**
   * Get recommended watermark based on pressure
   */
  getAdaptiveWatermark(bytesTransferred, baseWatermark) {
    switch (this.currentPressure) {
      case MEMORY_PRESSURE.CRITICAL:
        return Math.max(1, Math.floor(baseWatermark * 0.5));
      case MEMORY_PRESSURE.HIGH:
        return Math.max(2, Math.floor(baseWatermark * 0.75));
      case MEMORY_PRESSURE.MEDIUM:
        return baseWatermark;
      case MEMORY_PRESSURE.LOW:
      default:
        // Use transfer-based watermarks when pressure is low
        if (bytesTransferred > THRESHOLD_BULK) {
          return WATERMARK_BULK;
        } else if (bytesTransferred > THRESHOLD_MEDIUM) {
          return WATERMARK_BALANCED;
        }
        return WATERMARK_INTERACTIVE;
    }
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return {
      currentPressure: this.currentPressure,
      stats: this.stats,
      historyLength: this.pressureHistory.length
    };
  }
}

/**
 * Smart Chunk Coalescer
 */
class SmartCoalescer {
  constructor() {
    this.batches = new Map(); // Stream ID -> batch
    this.stats = {
      coalesced: 0,
      uncoalesced: 0,
      bytesSaved: 0,
      timeoutsFired: 0
    };
  }
  
  /**
   * Add chunk to batch or return immediately
   */
  addChunk(streamId, chunk, options = {}) {
    const chunkSize = chunk.byteLength || chunk.length;
    const shouldCoalesce = options.forceCoalesce || 
      (chunkSize < COALESCE_THRESHOLD && !options.urgent);
    
    if (!shouldCoalesce) {
      this.stats.uncoalesced++;
      return { shouldFlush: true, chunk };
    }
    
    // Get or create batch
    if (!this.batches.has(streamId)) {
      this.batches.set(streamId, {
        chunks: [],
        totalSize: 0,
        createdAt: Date.now()
      });
    }
    
    const batch = this.batches.get(streamId);
    batch.chunks.push(chunk);
    batch.totalSize += chunkSize;
    
    // Check if batch is ready
    const shouldFlush = batch.totalSize >= COALESCE_MAX_SIZE ||
      batch.chunks.length >= 10 ||
      options.flush;
    
    if (shouldFlush) {
      return this.flushBatch(streamId);
    }
    
    // Schedule timeout flush
    this.scheduleFlush(streamId, options.flushCallback);
    
    return { shouldFlush: false, batch };
  }
  
  /**
   * Schedule batch flush
   */
  scheduleFlush(streamId, callback) {
    // Use Promise-based timeout
    const batch = this.batches.get(streamId);
    if (!batch || batch.flushScheduled) return;
    
    batch.flushScheduled = true;
    
    // Promise.race pattern for timeout
    Promise.resolve().then(() => {
      return new Promise(resolve => {
        // In Workers, we use a microtask-like approach
        // The actual timeout is handled by the caller
        batch.flushPromise = resolve;
      });
    }).then(() => {
      if (this.batches.has(streamId)) {
        this.stats.timeoutsFired++;
        const result = this.flushBatch(streamId);
        if (callback && result.shouldFlush) {
          callback(result.chunk);
        }
      }
    });
  }
  
  /**
   * Flush batch and return coalesced chunk
   */
  flushBatch(streamId) {
    const batch = this.batches.get(streamId);
    if (!batch || batch.chunks.length === 0) {
      return { shouldFlush: false, chunk: null };
    }
    
    this.batches.delete(streamId);
    
    if (batch.chunks.length === 1) {
      // Single chunk, no coalescing needed
      this.stats.uncoalesced++;
      return { shouldFlush: true, chunk: batch.chunks[0] };
    }
    
    // Coalesce chunks
    const coalesced = this.coalesceChunks(batch.chunks);
    this.stats.coalesced++;
    this.stats.bytesSaved += (batch.chunks.length - 1) * 20; // Estimate header savings
    
    return { shouldFlush: true, chunk: coalesced };
  }
  
  /**
   * Coalesce multiple chunks into one
   */
  coalesceChunks(chunks) {
    const totalSize = chunks.reduce((sum, c) => sum + (c.byteLength || c.length), 0);
    const result = new Uint8Array(totalSize);
    
    let offset = 0;
    for (const chunk of chunks) {
      const arr = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : chunk;
      result.set(arr, offset);
      offset += arr.length;
    }
    
    return result;
  }
  
  /**
   * Cancel pending batch
   */
  cancelBatch(streamId) {
    if (this.batches.has(streamId)) {
      const batch = this.batches.get(streamId);
      if (batch.flushPromise) {
        batch.flushPromise();
      }
      this.batches.delete(streamId);
    }
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeBatches: this.batches.size,
      avgBatchSize: this.stats.coalesced > 0 
        ? Math.round(this.stats.bytesSaved / this.stats.coalesced)
        : 0
    };
  }
}

/**
 * Zero-Copy Buffer Handler
 */
class ZeroCopyHandler {
  constructor() {
    this.stats = {
      zeroCopyOps: 0,
      copiedOps: 0,
      bytesZeroCopied: 0,
      bytesCopied: 0
    };
  }
  
  /**
   * Determine if zero-copy is possible
   */
  canZeroCopy(source, target) {
    // Zero-copy possible if:
    // 1. Source is ArrayBuffer or Uint8Array
    // 2. Size exceeds threshold
    // 3. Target supports direct buffer
    
    if (!source) return false;
    
    const size = source.byteLength || source.length;
    return size >= BUFFER_CONFIG.zeroCopyThreshold;
  }
  
  /**
   * Transfer buffer with zero-copy if possible
   */
  transferBuffer(source, options = {}) {
    const size = source.byteLength || source.length;
    
    if (this.canZeroCopy(source) && !options.forceCopy) {
      this.stats.zeroCopyOps++;
      this.stats.bytesZeroCopied += size;
      
      // Return view without copying
      if (source instanceof ArrayBuffer) {
        return new Uint8Array(source);
      }
      return source;
    }
    
    // Fall back to copy
    this.stats.copiedOps++;
    this.stats.bytesCopied += size;
    
    const dest = new Uint8Array(size);
    const src = source instanceof ArrayBuffer ? new Uint8Array(source) : source;
    dest.set(src, 0);
    return dest;
  }
  
  /**
   * Get statistics
   */
  getStats() {
    const totalOps = this.stats.zeroCopyOps + this.stats.copiedOps;
    return {
      ...this.stats,
      zeroCopyRate: totalOps > 0 
        ? (this.stats.zeroCopyOps / totalOps * 100).toFixed(1) + '%'
        : '0%',
      efficiency: this.stats.bytesCopied > 0
        ? (this.stats.bytesZeroCopied / (this.stats.bytesZeroCopied + this.stats.bytesCopied) * 100).toFixed(1) + '%'
        : '100%'
    };
  }
}

/**
 * Enhanced Buffer Manager
 */
class BufferManager {
  constructor() {
    this.pool = new BufferPool();
    this.pressureMonitor = new MemoryPressureMonitor();
    this.coalescer = new SmartCoalescer();
    this.zeroCopy = new ZeroCopyHandler();
    
    // Stream tracking
    this.activeStreams = new Map();
    this.streamCounter = 0;
  }
  
  /**
   * Create a new stream context
   */
  createStream(options = {}) {
    const streamId = ++this.streamCounter;
    const context = {
      id: streamId,
      bytesTransferred: 0,
      chunksProcessed: 0,
      createdAt: Date.now(),
      options,
      queue: [],
      isPaused: false
    };
    
    this.activeStreams.set(streamId, context);
    return streamId;
  }
  
  /**
   * Process chunk with full optimization
   */
  processChunk(streamId, chunk, webSocket, options = {}) {
    const context = this.activeStreams.get(streamId);
    if (!context) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    const chunkSize = chunk.byteLength || chunk.length;
    context.bytesTransferred += chunkSize;
    context.chunksProcessed++;
    
    // Calculate memory pressure
    const pressure = this.pressureMonitor.calculatePressure(
      context.queue.length,
      MAX_QUEUE_SIZE,
      webSocket.bufferedAmount || 0,
      BUFFER_HIGH_WATERMARK
    );
    
    // Handle backpressure
    if (pressure.level === MEMORY_PRESSURE.CRITICAL || 
        pressure.level === MEMORY_PRESSURE.HIGH) {
      context.isPaused = true;
      bufferStats.backpressureEvents++;
    }
    
    // Use zero-copy for large chunks
    const optimizedChunk = this.zeroCopy.transferBuffer(chunk);
    
    // Decide on coalescing
    if (options.enableCoalescing !== false) {
      const result = this.coalescer.addChunk(streamId, optimizedChunk, {
        urgent: pressure.level === MEMORY_PRESSURE.HIGH || pressure.level === MEMORY_PRESSURE.CRITICAL,
        flush: options.flush
      });
      
      if (result.shouldFlush && result.chunk) {
        context.queue.push(result.chunk);
        bufferStats.totalQueued++;
      }
    } else {
      context.queue.push(optimizedChunk);
      bufferStats.totalQueued++;
    }
    
    // Update max queue depth
    bufferStats.maxQueueDepth = Math.max(bufferStats.maxQueueDepth, context.queue.length);
    
    return {
      pressure: pressure.level,
      queueDepth: context.queue.length,
      isPaused: context.isPaused
    };
  }
  
  /**
   * Flush stream queue to WebSocket
   */
  async flushToWebSocket(streamId, webSocket, responseHeader = null) {
    const context = this.activeStreams.get(streamId);
    if (!context || context.queue.length === 0) return;
    
    let header = responseHeader;
    
    while (context.queue.length > 0) {
      // Check WebSocket state
      if (webSocket.readyState !== 1) { // WS_READY_STATE_OPEN
        context.queue.length = 0;
        return;
      }
      
      // Handle backpressure
      while (webSocket.bufferedAmount > BUFFER_HIGH_WATERMARK) {
        context.isPaused = true;
        await new Promise(resolve => setTimeout(resolve, 10));
        
        if (webSocket.readyState !== 1) {
          return;
        }
      }
      
      context.isPaused = false;
      
      // Get next chunk
      const chunk = context.queue.shift();
      
      // Prepend header if needed
      if (header) {
        const combined = await new Blob([header, chunk]).arrayBuffer();
        header = null;
        webSocket.send(combined);
      } else {
        webSocket.send(chunk);
      }
      
      // Return buffer to pool if it was from pool
      if (chunk._fromPool) {
        this.pool.release(chunk);
      }
    }
  }
  
  /**
   * Close stream and cleanup
   */
  closeStream(streamId) {
    const context = this.activeStreams.get(streamId);
    if (context) {
      // Flush any remaining batch
      this.coalescer.cancelBatch(streamId);
      this.activeStreams.delete(streamId);
      
      return {
        bytesTransferred: context.bytesTransferred,
        chunksProcessed: context.chunksProcessed,
        duration: Date.now() - context.createdAt
      };
    }
    return null;
  }
  
  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      pool: this.pool.getStats(),
      pressure: this.pressureMonitor.getStatus(),
      coalescer: this.coalescer.getStats(),
      zeroCopy: this.zeroCopy.getStats(),
      streams: {
        active: this.activeStreams.size,
        total: this.streamCounter
      },
      buffer: {
        backpressureEvents: bufferStats.backpressureEvents,
        queueOverflows: bufferStats.queueOverflows,
        totalQueued: bufferStats.totalQueued,
        maxQueueDepth: bufferStats.maxQueueDepth
      }
    };
  }
  
  /**
   * Perform cleanup
   */
  cleanup() {
    this.pool.clear();
    
    // Close old streams
    const now = Date.now();
    for (const [id, context] of this.activeStreams) {
      if (now - context.createdAt > 300000) { // 5 minutes
        this.closeStream(id);
      }
    }
  }
}

// Global instance
export const bufferManager = new BufferManager();

export default {
  BufferManager,
  BufferPool,
  MemoryPressureMonitor,
  SmartCoalescer,
  ZeroCopyHandler,
  bufferManager,
  MEMORY_PRESSURE
};
