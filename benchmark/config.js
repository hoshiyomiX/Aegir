/**
 * Benchmark Configuration
 * 
 * Adjust these values to customize benchmark behavior
 */

export const config = {
  // Iteration counts for different benchmark modes
  iterations: {
    quick: parseInt(process.env.BENCH_ITER_QUICK || '100'),
    standard: parseInt(process.env.BENCH_ITER_STANDARD || '1000'),
    thorough: parseInt(process.env.BENCH_ITER_THOROUGH || '5000')
  },
  
  // Test data sizes
  dataSizes: {
    small: parseInt(process.env.BENCH_SIZE_SMALL || '100'),
    medium: parseInt(process.env.BENCH_SIZE_MEDIUM || '1000'),
    large: parseInt(process.env.BENCH_SIZE_LARGE || '5000')
  },
  
  // Performance thresholds (in milliseconds)
  thresholds: {
    // Proxy generation should be fast
    proxyGenerationPerItem: parseFloat(process.env.BENCH_THRESHOLD_PROXY || '0.5'),
    
    // Country filtering should be very fast
    countryFilterPerItem: parseFloat(process.env.BENCH_THRESHOLD_COUNTRY || '0.1'),
    
    // Map operations should be instant
    boundedMapOperation: parseFloat(process.env.BENCH_THRESHOLD_MAP || '0.01'),
    
    // Stream chunks should process quickly
    streamChunk: parseFloat(process.env.BENCH_THRESHOLD_STREAM || '0.1'),
    
    // Memory growth should be controlled
    memoryGrowthRate: parseFloat(process.env.BENCH_THRESHOLD_MEMORY || '1.5'),
    
    // DNS cache operations
    dnsCacheOp: parseFloat(process.env.BENCH_THRESHOLD_DNS || '0.005'),
    
    // Request deduplication
    dedupOp: parseFloat(process.env.BENCH_THRESHOLD_DEDUP || '0.01'),
    
    // Base64 encoding
    base64Op: parseFloat(process.env.BENCH_THRESHOLD_B64 || '1.0')
  },
  
  // Feature flags
  features: {
    warmup: process.env.BENCH_WARMUP !== 'false',
    gc: process.env.BENCH_GC !== 'false',
    detailed: process.env.BENCH_DETAILED === 'true'
  },
  
  // Output options
  output: {
    json: process.env.BENCH_OUTPUT_JSON !== 'false',
    markdown: process.env.BENCH_OUTPUT_MD !== 'false',
    console: process.env.BENCH_OUTPUT_CONSOLE !== 'false'
  }
};

export default config;
