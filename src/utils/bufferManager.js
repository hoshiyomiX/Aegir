/**
 * Enhanced Buffer & Memory Management
 * Improvements: Zero-copy optimizations, memory pressure detection, buffer pooling,
 * intelligent batching with adaptive thresholds
 */

import { 
  WS_READY_STATE_OPEN, 
  WS_READY_STATE_CLOSING,
  BUFFER_HIGH_WATERMARK,
  BUFFER_LOW_WATERMARK,
  MAX_QUEUE_SIZE,
  THRESHOLD_MEDIUM,
  THRESHOLD_BULK,
  WATERMARK_INTERACTIVE,
  WATERMARK_BALANCED,
  WATERMARK_BULK,
  COALESCE_THRESHOLD,
  COALESCE_MAX_SIZE,
  COALESCE_TIMEOUT
} from '../config/constants.js';

// ============ MEMORY PRESSURE DETECTION ============

/**
 * Memory pressure levels
 */
export const MEMORY_PRESSURE = {
  LOW: 'LOW',           // < 50% memory usage
  MEDIUM: 'MEDIUM',     // 50-75% memory usage
  HIGH: 'HIGH',         // 75-90% memory usage
  CRITICAL: 'CRITICAL'  // > 90% memory usage
};

/**
 * Memory pressure manager
 */
export class MemoryPressureManager {
  constructor() {
    this.samples = [];
    this.maxSamples = 60; // 1 minute of samples at 1s interval
    this.currentPressure = MEMORY_PRESSURE.LOW;
    this.listeners = new Map();
    this.stats = {
      lowCount: 0,
      mediumCount: 0,
      highCount: 0,
      criticalCount: 0,
      peakUsage: 0
    };
  }

  /**
   * Update memory pressure based on current usage
   */
  update(usedBytes, totalBytes) {
    const usage = usedBytes / totalBytes;
    const now = Date.now();
    
    this.samples.push({ usage, timestamp: now, usedBytes, totalBytes });
    
    // Keep bounded history
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    
    // Update peak
    if (usedBytes > this.stats.peakUsage) {
      this.stats.peakUsage = usedBytes;
    }
    
    // Determine pressure level
    let newPressure;
    if (usage < 0.5) {
      newPressure = MEMORY_PRESSURE.LOW;
      this.stats.lowCount++;
    } else if (usage < 0.75) {
      newPressure = MEMORY_PRESSURE.MEDIUM;
      this.stats.mediumCount++;
    } else if (usage < 0.9) {
      newPressure = MEMORY_PRESSURE.HIGH;
      this.stats.highCount++;
    } else {
      newPressure = MEMORY_PRESSURE.CRITICAL;
      this.stats.criticalCount++;
    }
    
    // Notify listeners on pressure change
    if (newPressure !== this.currentPressure) {
      const oldPressure = this.currentPressure;
      this.currentPressure = newPressure;
      this._notifyListeners(oldPressure, newPressure);
    }
    
    return {
      pressure: this.currentPressure,
      usage: (usage * 100).toFixed(1) + '%',
      usedBytes,
      totalBytes
    };
  }

  /**
   * Get adaptive watermarks based on memory pressure
   */
  getAdaptiveWatermarks() {
    switch (this.currentPressure) {
      case MEMORY_PRESSURE.CRITICAL:
        return {
          high: BUFFER_HIGH_WATERMARK / 4,  // 64KB
          low: BUFFER_LOW_WATERMARK / 4,    // 16KB
          batchSize: COALESCE_MAX_SIZE / 4  // 32KB
        };
      case MEMORY_PRESSURE.HIGH:
        return {
          high: BUFFER_HIGH_WATERMARK / 2,  // 128KB
          low: BUFFER_LOW_WATERMARK / 2,    // 32KB
          batchSize: COALESCE_MAX_SIZE / 2  // 64KB
        };
      case MEMORY_PRESSURE.MEDIUM:
        return {
          high: BUFFER_HIGH_WATERMARK * 0.75, // 192KB
          low: BUFFER_LOW_WATERMARK * 0.75,   // 48KB
          batchSize: COALESCE_MAX_SIZE * 0.75 // 96KB
        };
      default:
        return {
          high: BUFFER_HIGH_WATERMARK,
          low: BUFFER_LOW_WATERMARK,
          batchSize: COALESCE_MAX_SIZE
        };
    }
  }

  /**
   * Subscribe to pressure changes
   */
  onPressureChange(callback) {
    const id = Date.now() + Math.random();
    this.listeners.set(id, callback);
    return () => this.listeners.delete(id);
  }

  /**
   * Get average memory usage
   */
  getAverageUsage() {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((acc, s) => acc + s.usage, 0);
    return sum / this.samples.length;
  }

  _notifyListeners(oldPressure, newPressure) {
    for (const callback of this.listeners.values()) {
      try {
        callback(oldPressure, newPressure);
      } catch (e) {
        console.error('[MemoryPressure] Listener error:', e);
      }
    }
  }
}

// ============ BUFFER POOL (ZERO-COPY OPTIMIZATION) ============

/**
 * Buffer pool for reusing buffers and reducing GC pressure
 */
export class BufferPool {
  constructor(options = {}) {
    this.pools = new Map(); // Size -> Array of buffers
    this.config = {
      maxPoolSize: options.maxPoolSize || 100,
      minBufferSize: options.minBufferSize || 1024,    // 1KB
      maxBufferSize: options.maxBufferSize || 262144,  // 256KB
      growthFactor: options.growthFactor || 2,
      enabled: options.enabled !== false
    };
    this.stats = {
      allocated: 0,
      reused: 0,
      returned: 0,
      dropped: 0,
      bytesSaved: 0
    };
  }

  /**
   * Get buffer of appropriate size (rounds up to pool size)
   */
  get(size) {
    if (!this.config.enabled) {
      return new Uint8Array(size);
    }
    
    const poolSize = this._getPoolSize(size);
    const pool = this.pools.get(poolSize);
    
    if (pool && pool.length > 0) {
      const buffer = pool.pop();
      this.stats.reused++;
      this.stats.bytesSaved += poolSize;
      return buffer;
    }
    
    this.stats.allocated++;
    return new Uint8Array(poolSize);
  }

  /**
   * Return buffer to pool
   */
  release(buffer) {
    if (!this.config.enabled || !buffer) return;
    
    const size = buffer.byteLength || buffer.length;
    
    // Don't pool very large or very small buffers
    if (size < this.config.minBufferSize || size > this.config.maxBufferSize) {
      this.stats.dropped++;
      return;
    }
    
    const poolSize = this._getPoolSize(size);
    
    if (!this.pools.has(poolSize)) {
      this.pools.set(poolSize, []);
    }
    
    const pool = this.pools.get(poolSize);
    
    // Limit pool size
    if (pool.length >= this.config.maxPoolSize) {
      this.stats.dropped++;
      return;
    }
    
    // Clear buffer before returning to pool
    if (buffer.fill) {
      buffer.fill(0);
    }
    
    pool.push(buffer);
    this.stats.returned++;
  }

  /**
   * Get appropriate pool size (next power of 2)
   */
  _getPoolSize(size) {
    const minSize = this.config.minBufferSize;
    if (size <= minSize) return minSize;
    
    let poolSize = minSize;
    while (poolSize < size && poolSize < this.config.maxBufferSize) {
      poolSize *= this.config.growthFactor;
    }
    return Math.min(poolSize, this.config.maxBufferSize);
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
    let totalBytes = 0;
    
    for (const [size, pool] of this.pools) {
      totalBuffers += pool.length;
      totalBytes += size * pool.length;
    }
    
    return {
      poolCount: this.pools.size,
      totalBuffers,
      totalBytes,
      reuseRate: this.stats.allocated + this.stats.reused > 0
        ? (this.stats.reused / (this.stats.allocated + this.stats.reused) * 100).toFixed(1) + '%'
        : '0%',
      ...this.stats
    };
  }
}

// ============ INTELLIGENT BATCHER ============

/**
 * Intelligent chunk batcher with adaptive thresholds
 */
export class IntelligentBatcher {
  constructor(options = {}) {
    this.config = {
      threshold: options.threshold || COALESCE_THRESHOLD,
      maxSize: options.maxSize || COALESCE_MAX_SIZE,
      timeout: options.timeout || COALESCE_TIMEOUT,
      enableAdaptive: options.enableAdaptive !== false
    };
    
    this.batches = new Map(); // streamId -> batch
    this.stats = {
      batched: 0,
      unbatched: 0,
      flushes: 0,
      timeouts: 0,
      sizeFlushes: 0,
      totalSavings: 0,
      avgBatchSize: 0
    };
    
    this.batchSizeHistory = [];
    this.adaptiveThreshold = this.config.threshold;
  }

  /**
   * Add chunk to batch or return for immediate send
   */
  add(streamId, chunk, forceFlush = false) {
    const chunkSize = chunk.byteLength || chunk.length;
    
    // Don't batch large chunks
    if (chunkSize >= this.adaptiveThreshold || forceFlush) {
      this.stats.unbatched++;
      return { shouldFlush: true, data: chunk };
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
    
    // Check if batch should be flushed
    if (batch.totalSize >= this.config.maxSize) {
      this.stats.sizeFlushes++;
      return this._flushBatch(streamId);
    }
    
    return { shouldFlush: false, pending: true };
  }

  /**
   * Check for timed-out batches
   */
  checkTimeout(streamId) {
    const batch = this.batches.get(streamId);
    if (!batch) return null;
    
    const age = Date.now() - batch.createdAt;
    if (age >= this.config.timeout) {
      this.stats.timeouts++;
      return this._flushBatch(streamId);
    }
    
    return null;
  }

  /**
   * Force flush a batch
   */
  flush(streamId) {
    if (this.batches.has(streamId)) {
      return this._flushBatch(streamId);
    }
    return null;
  }

  /**
   * Flush all batches
   */
  flushAll() {
    const results = [];
    for (const streamId of this.batches.keys()) {
      const result = this._flushBatch(streamId);
      if (result) results.push({ streamId, ...result });
    }
    return results;
  }

  /**
   * Update adaptive threshold based on performance
   */
  updateAdaptiveThreshold(avgLatency) {
    if (!this.config.enableAdaptive) return;
    
    // If latency is low, increase threshold to batch more
    // If latency is high, decrease threshold to send faster
    if (avgLatency < 50) {
      this.adaptiveThreshold = Math.min(this.adaptiveThreshold * 1.1, this.config.maxSize / 2);
    } else if (avgLatency > 200) {
      this.adaptiveThreshold = Math.max(this.adaptiveThreshold * 0.9, 4096);
    }
  }

  _flushBatch(streamId) {
    const batch = this.batches.get(streamId);
    if (!batch || batch.chunks.length === 0) {
      this.batches.delete(streamId);
      return null;
    }
    
    this.batches.delete(streamId);
    
    // If single chunk, return as-is (zero-copy)
    if (batch.chunks.length === 1) {
      this.stats.unbatched++;
      return { shouldFlush: true, data: batch.chunks[0], chunkCount: 1 };
    }
    
    // Combine chunks efficiently
    const combined = this._combineChunks(batch.chunks);
    
    this.stats.batched++;
    this.stats.flushes++;
    this.stats.totalSavings += batch.chunks.length - 1;
    
    // Track batch size history
    this.batchSizeHistory.push(batch.chunks.length);
    if (this.batchSizeHistory.length > 100) {
      this.batchSizeHistory.shift();
    }
    
    // Update average
    const sum = this.batchSizeHistory.reduce((a, b) => a + b, 0);
    this.stats.avgBatchSize = (sum / this.batchSizeHistory.length).toFixed(1);
    
    return { shouldFlush: true, data: combined, chunkCount: batch.chunks.length };
  }

  /**
   * Combine chunks efficiently (minimizing copies)
   */
  _combineChunks(chunks) {
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
   * Get statistics
   */
  getStats() {
    const activeBatches = this.batches.size;
    return {
      activeBatches,
      adaptiveThreshold: Math.round(this.adaptiveThreshold),
      ...this.stats
    };
  }
}

// ============ ENHANCED STREAM PUMP ============

/**
 * Enhanced remote socket to WebSocket with all optimizations
 */
export class EnhancedStreamPump {
  constructor(options = {}) {
    this.bufferPool = options.bufferPool || new BufferPool();
    this.memoryManager = options.memoryManager || new MemoryPressureManager();
    this.batcher = options.batcher || new IntelligentBatcher();
    
    this.stats = {
      bytesTransferred: 0,
      chunksProcessed: 0,
      backpressureEvents: 0,
      zeroCopyHits: 0
    };
  }

  /**
   * Pipe remote socket to WebSocket with optimizations
   */
  async pipeToWebSocket(remoteSocket, webSocket, options = {}) {
    const {
      responseHeader = null,
      retry = null,
      log = null,
      targetAddress = null,
      targetPort = null
    } = options;
    
    let header = responseHeader;
    let hasIncomingData = false;
    let bytesTransferred = 0;
    const streamId = `${targetAddress}:${targetPort}:${Date.now()}`;
    
    const queue = [];
    let isPaused = false;
    
    // Get adaptive watermarks based on memory pressure
    const watermarks = this.memoryManager.getAdaptiveWatermarks();
    
    const flushQueue = async () => {
      while (queue.length > 0 && !isPaused) {
        if (webSocket.readyState !== WS_READY_STATE_OPEN) {
          queue.length = 0;
          return;
        }
        
        // Check backpressure
        if (webSocket.bufferedAmount > watermarks.high) {
          this.stats.backpressureEvents++;
          isPaused = true;
          
          while (webSocket.bufferedAmount > watermarks.low) {
            await this._delay(10);
            if (webSocket.readyState !== WS_READY_STATE_OPEN) return;
          }
          
          isPaused = false;
        }
        
        const chunk = queue.shift();
        if (chunk) {
          try {
            webSocket.send(chunk);
            bytesTransferred += chunk.byteLength || chunk.length;
            this.stats.bytesTransferred += chunk.byteLength || chunk.length;
          } catch (e) {
            if (log) log('[StreamPump] Send error:', e);
            queue.length = 0;
            return;
          }
        }
      }
    };
    
    try {
      await remoteSocket.readable.pipeTo(
        new WritableStream({
          async write(chunk, controller) {
            hasIncomingData = true;
            this.stats.chunksProcessed++;
            
            if (webSocket.readyState !== WS_READY_STATE_OPEN) {
              controller.error('WebSocket not open');
              return;
            }
            
            let dataToSend = chunk;
            
            // Prepend header if present (only once)
            if (header) {
              // Combine header and first chunk
              const headerArr = header instanceof Uint8Array ? header : new Uint8Array(header);
              const chunkArr = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
              dataToSend = new Uint8Array(headerArr.length + chunkArr.length);
              dataToSend.set(headerArr, 0);
              dataToSend.set(chunkArr, headerArr.length);
              header = null;
            }
            
            // Check batcher
            const batchResult = this.batcher.add(streamId, dataToSend);
            
            if (batchResult.shouldFlush) {
              queue.push(batchResult.data);
              await flushQueue();
            }
            
            // Check for timed-out batches
            const timeoutResult = this.batcher.checkTimeout(streamId);
            if (timeoutResult) {
              queue.push(timeoutResult.data);
              await flushQueue();
            }
          }.bind(this),
          
          close() {
            if (log) log(`[StreamPump] Remote closed. Transferred: ${(bytesTransferred/1024/1024).toFixed(2)}MB`);
            
            // Flush remaining batch
            const finalBatch = this.batcher.flush(streamId);
            if (finalBatch) {
              queue.push(finalBatch.data);
              flushQueue();
            }
          }.bind(this),
          
          abort(reason) {
            console.error('[StreamPump] Aborted:', reason);
            this.batcher.flush(streamId);
            queue.length = 0;
          }.bind(this)
        }),
        {
          highWaterMark: bytesTransferred > THRESHOLD_BULK ? WATERMARK_BULK :
                         bytesTransferred > THRESHOLD_MEDIUM ? WATERMARK_BALANCED :
                         WATERMARK_INTERACTIVE,
          size: chunk => chunk.byteLength || chunk.length
        }
      );
      
      // Final flush
      const finalBatch = this.batcher.flush(streamId);
      if (finalBatch) {
        queue.push(finalBatch.data);
      }
      await flushQueue();
      
    } catch (error) {
      console.error('[StreamPump] Error:', error);
      this.batcher.flush(streamId);
      queue.length = 0;
      
      try {
        if (webSocket.readyState === WS_READY_STATE_OPEN || 
            webSocket.readyState === WS_READY_STATE_CLOSING) {
          webSocket.close();
        }
      } catch (e) {
        // Silent fail
      }
    }
    
    // Retry if no data was received
    if (!hasIncomingData && retry) {
      if (log) log('[StreamPump] No data received, triggering retry');
      retry();
    }
    
    return { bytesTransferred };
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get combined statistics
   */
  getStats() {
    return {
      streamPump: this.stats,
      bufferPool: this.bufferPool.getStats(),
      batcher: this.batcher.getStats()
    };
  }
}

// ============ SINGLETON INSTANCES ============

export const memoryPressureManager = new MemoryPressureManager();
export const bufferPool = new BufferPool();
export const intelligentBatcher = new IntelligentBatcher();

// ============ SAFE WEBSOCKET CLOSE ============

export function safeCloseWebSocket(socket) {
  try {
    if (socket.readyState === WS_READY_STATE_OPEN || 
        socket.readyState === WS_READY_STATE_CLOSING) {
      socket.close();
    }
  } catch (error) {
    console.error('[safeCloseWebSocket] Error:', error);
  }
}

// ============ EXPORTS ============

export default {
  MemoryPressureManager,
  BufferPool,
  IntelligentBatcher,
  EnhancedStreamPump,
  memoryPressureManager,
  bufferPool,
  intelligentBatcher,
  safeCloseWebSocket,
  MEMORY_PRESSURE
};
