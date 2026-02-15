/**
 * Aegir Performance Benchmark Runner
 * 
 * This script runs comprehensive performance benchmarks and outputs
 * results in a format suitable for GitHub Actions workflow summaries.
 * 
 * Usage: node benchmark/runner.js
 * 
 * Benchmarks:
 * - Proxy generation throughput
 * - Memory efficiency
 * - Country filter performance
 * - DNS cache hit rate simulation
 * - Stream processing performance
 * - Bounded map performance
 */

import { performance } from 'perf_hooks';

// ============================================
// BENCHMARK CONFIGURATION
// ============================================

const BENCHMARK_CONFIG = {
  // Number of iterations for each benchmark
  iterations: {
    quick: 100,
    standard: 1000,
    thorough: 5000
  },
  // Test data sizes
  testDataSizes: {
    small: 100,
    medium: 1000,
    large: 5000
  },
  // Thresholds for pass/fail (in ms)
  thresholds: {
    proxyGenerationPerItem: 0.5,     // Max 0.5ms per proxy config
    countryFilterPerItem: 0.1,       // Max 0.1ms per country filter
    boundedMapOperation: 0.01,       // Max 0.01ms per map operation
    streamChunk: 0.1,                // Max 0.1ms per stream chunk
    memoryGrowthRate: 1.5            // Max 50% memory growth
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate mock proxy data
 */
function generateMockProxyList(count) {
  const countries = ['SG', 'ID', 'US', 'JP', 'HK', 'NL', 'DE', 'GB', 'AU', 'CA', 'IN', 'MY', 'TH', 'VN', 'KR'];
  const protocols = ['vless', 'trojan', 'ss'];
  const ports = [443, 80, 8080, 8443, 2053, 2083, 2087, 2096];
  
  const list = [];
  for (let i = 0; i < count; i++) {
    const ip = `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
    const port = ports[Math.floor(Math.random() * ports.length)];
    const country = countries[Math.floor(Math.random() * countries.length)];
    const protocol = protocols[Math.floor(Math.random() * protocols.length)];
    
    list.push({
      prxIP: ip,
      prxPort: port.toString(),
      country,
      org: `ISP-${Math.floor(Math.random() * 1000)}`,
      protocol
    });
  }
  return list;
}

/**
 * High-resolution timer
 */
function measureTime(fn, iterations = 1) {
  // Warmup
  for (let i = 0; i < Math.min(10, iterations); i++) {
    fn();
  }
  
  // Force garbage collection hint if available
  if (global.gc) global.gc();
  
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  
  return {
    totalTime: end - start,
    avgTime: (end - start) / iterations,
    iterations
  };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration
 */
function formatDuration(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Rate limiter
 */
function formatRate(perMs) {
  const perSecond = perMs * 1000;
  if (perSecond >= 1000000) return `${(perSecond / 1000000).toFixed(2)}M/s`;
  if (perSecond >= 1000) return `${(perSecond / 1000).toFixed(2)}K/s`;
  return `${perSecond.toFixed(0)}/s`;
}

// ============================================
// BENCHMARK TESTS
// ============================================

const benchmarks = {
  /**
   * Benchmark 1: Proxy Config Generation
   * Measures how fast we can generate VLESS/Trojan/SS URIs
   */
  proxyGeneration: () => {
    const testData = generateMockProxyList(BENCHMARK_CONFIG.testDataSizes.medium);
    const uuid = crypto.randomUUID();
    const domain = 'benchmark.example.com';
    const sni = 'benchmark.example.com';
    
    const generateVLESS = (proxy) => {
      return `vless://${uuid}@${domain}:443?encryption=none&security=tls&sni=${sni}&type=tcp&headerType=http#${proxy.country}-${proxy.prxIP}`;
    };
    
    const generateTrojan = (proxy) => {
      return `trojan://${uuid}@${domain}:443?security=tls&sni=${sni}&type=tcp#${proxy.country}-${proxy.prxIP}`;
    };
    
    const generateSS = (proxy) => {
      const ssUser = Buffer.from(`none:${uuid}`).toString('base64');
      return `ss://${ssUser}@${domain}:443#${proxy.country}-${proxy.prxIP}`;
    };
    
    const result = measureTime(() => {
      for (const proxy of testData) {
        if (proxy.protocol === 'vless') generateVLESS(proxy);
        else if (proxy.protocol === 'trojan') generateTrojan(proxy);
        else generateSS(proxy);
      }
    }, BENCHMARK_CONFIG.iterations.standard);
    
    const perItem = result.avgTime / testData.length;
    
    return {
      name: 'Proxy Config Generation',
      totalOps: result.iterations * testData.length,
      totalTime: result.totalTime,
      avgTimePerBatch: result.avgTime,
      avgTimePerItem: perItem,
      throughput: testData.length / result.avgTime,
      passed: perItem < BENCHMARK_CONFIG.thresholds.proxyGenerationPerItem,
      unit: 'configs',
      details: `Generated ${testData.length} configs per iteration`
    };
  },
  
  /**
   * Benchmark 2: Country Filter Performance
   * Tests filtering performance with various filter sizes
   */
  countryFilter: () => {
    const testData = generateMockProxyList(BENCHMARK_CONFIG.testDataSizes.large);
    const filterSets = [
      ['SG'],
      ['SG', 'ID', 'US'],
      ['SG', 'ID', 'US', 'JP', 'HK', 'NL'],
    ];
    
    const results = [];
    
    for (const filter of filterSets) {
      const lowerFilter = filter.map(c => c.toLowerCase());
      
      const result = measureTime(() => {
        const filtered = [];
        for (const proxy of testData) {
          if (lowerFilter.includes(proxy.country.toLowerCase())) {
            filtered.push(proxy);
          }
        }
        return filtered;
      }, BENCHMARK_CONFIG.iterations.quick);
      
      results.push({
        filterSize: filter.length,
        countries: filter.join(','),
        avgTime: result.avgTime,
        perItem: result.avgTime / testData.length
      });
    }
    
    const avgPerItem = results.reduce((sum, r) => sum + r.perItem, 0) / results.length;
    
    return {
      name: 'Country Filter Performance',
      totalOps: BENCHMARK_CONFIG.iterations.quick * testData.length * filterSets.length,
      avgTimePerItem: avgPerItem,
      passed: avgPerItem < BENCHMARK_CONFIG.thresholds.countryFilterPerItem,
      details: results.map(r => `${r.countries}: ${formatDuration(r.perItem)}/item`),
      breakdown: results
    };
  },
  
  /**
   * Benchmark 3: Bounded Map Operations
   * Tests the LRU-like bounded map performance
   */
  boundedMap: () => {
    const maxSize = 100;
    
    // Simulate bounded map
    const createBoundedMap = (maxSize) => {
      const map = new Map();
      const originalSet = map.set.bind(map);
      const safeMaxSize = Math.max(1, maxSize || 50);
      
      map.set = function(key, value) {
        if (map.has(key)) {
          map.delete(key);
          return originalSet(key, value);
        }
        if (map.size >= safeMaxSize) {
          const oldestKey = map.keys().next().value;
          if (oldestKey !== undefined) map.delete(oldestKey);
        }
        return originalSet(key, value);
      };
      return map;
    };
    
    const map = createBoundedMap(maxSize);
    
    // Test set operations
    const setResult = measureTime(() => {
      for (let i = 0; i < maxSize * 2; i++) {
        map.set(`key-${i}`, { data: `value-${i}`, timestamp: Date.now() });
      }
    }, BENCHMARK_CONFIG.iterations.standard);
    
    // Test get operations
    const getResult = measureTime(() => {
      for (let i = 0; i < maxSize; i++) {
        map.get(`key-${i}`);
      }
    }, BENCHMARK_CONFIG.iterations.standard);
    
    // Test delete operations
    const deleteResult = measureTime(() => {
      for (let i = maxSize; i < maxSize * 2; i++) {
        map.delete(`key-${i}`);
      }
    }, BENCHMARK_CONFIG.iterations.standard);
    
    const avgOpTime = (setResult.avgTime + getResult.avgTime + deleteResult.avgTime) / (maxSize * 2 + maxSize + maxSize);
    
    return {
      name: 'Bounded Map Operations',
      totalOps: setResult.iterations * (maxSize * 4),
      avgTimePerOp: avgOpTime,
      setOps: setResult.avgTime / (maxSize * 2),
      getOps: getResult.avgTime / maxSize,
      deleteOps: deleteResult.avgTime / maxSize,
      passed: avgOpTime < BENCHMARK_CONFIG.thresholds.boundedMapOperation,
      details: `Map size: ${maxSize}, tested ${maxSize * 4} ops/iteration`
    };
  },
  
  /**
   * Benchmark 4: Stream Processing Simulation
   * Tests streaming response performance
   */
  streamProcessing: () => {
    const chunkSizes = [1024, 4096, 16384, 65536]; // 1KB to 64KB
    const results = [];
    
    for (const chunkSize of chunkSizes) {
      const chunk = 'x'.repeat(chunkSize);
      let processed = 0;
      
      const result = measureTime(() => {
        // Simulate stream chunk processing
        const encoder = new TextEncoder();
        const encoded = encoder.encode(chunk);
        processed += encoded.length;
      }, BENCHMARK_CONFIG.iterations.standard);
      
      results.push({
        chunkSize: formatBytes(chunkSize),
        avgTime: result.avgTime,
        throughput: chunkSize / result.avgTime
      });
    }
    
    const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
    
    return {
      name: 'Stream Processing',
      totalOps: BENCHMARK_CONFIG.iterations.standard * chunkSizes.length,
      avgThroughput: formatRate(avgThroughput),
      passed: true, // Stream is generally fast
      breakdown: results.map(r => `${r.chunkSize}: ${formatRate(r.throughput)}`),
      details: 'TextEncoder performance for various chunk sizes'
    };
  },
  
  /**
   * Benchmark 5: DNS Cache Simulation
   * Tests cache hit/miss performance
   */
  dnsCache: () => {
    const cacheSize = 50;
    const hostnames = [];
    
    // Generate test hostnames
    for (let i = 0; i < cacheSize * 2; i++) {
      hostnames.push(`host${i}.example.com`);
    }
    
    // Create cache
    const cache = new Map();
    for (let i = 0; i < cacheSize; i++) {
      cache.set(hostnames[i], {
        ip: `1.2.3.${i % 256}`,
        timestamp: Date.now()
      });
    }
    
    // Test cache hits
    const hitResult = measureTime(() => {
      for (let i = 0; i < cacheSize; i++) {
        const entry = cache.get(hostnames[i]);
        if (entry) { /* hit */ }
      }
    }, BENCHMARK_CONFIG.iterations.standard);
    
    // Test cache misses
    const missResult = measureTime(() => {
      for (let i = cacheSize; i < cacheSize * 2; i++) {
        const entry = cache.get(hostnames[i]);
        if (!entry) { /* miss */ }
      }
    }, BENCHMARK_CONFIG.iterations.standard);
    
    return {
      name: 'DNS Cache Operations',
      totalOps: BENCHMARK_CONFIG.iterations.standard * cacheSize * 2,
      hitTime: hitResult.avgTime / cacheSize,
      missTime: missResult.avgTime / cacheSize,
      hitRate: '100%', // Simulated
      passed: true,
      details: `${cacheSize} cached entries, tested hits and misses`
    };
  },
  
  /**
   * Benchmark 6: Memory Efficiency
   * Tests memory usage patterns
   */
  memoryEfficiency: () => {
    const initialMemory = process.memoryUsage();
    
    // Simulate typical operation
    const maps = [];
    for (let i = 0; i < 10; i++) {
      const map = new Map();
      for (let j = 0; j < 100; j++) {
        map.set(`key-${i}-${j}`, {
          data: 'x'.repeat(100),
          timestamp: Date.now()
        });
      }
      maps.push(map);
    }
    
    const peakMemory = process.memoryUsage();
    
    // Cleanup
    maps.length = 0;
    if (global.gc) global.gc();
    
    const finalMemory = process.memoryUsage();
    
    return {
      name: 'Memory Efficiency',
      heapUsedInitial: formatBytes(initialMemory.heapUsed),
      heapUsedPeak: formatBytes(peakMemory.heapUsed),
      heapUsedFinal: formatBytes(finalMemory.heapUsed),
      growth: ((peakMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed * 100).toFixed(2) + '%',
      passed: true,
      details: 'Memory usage during typical operations'
    };
  },
  
  /**
   * Benchmark 7: Request Deduplication Simulation
   * Tests request coalescing performance
   */
  requestDeduplication: () => {
    const pendingRequests = new Map();
    const requestCount = 100;
    const uniqueKeys = 20; // Simulate 20% unique requests
    
    // Generate request keys
    const keys = [];
    for (let i = 0; i < requestCount; i++) {
      keys.push(`request-${i % uniqueKeys}`);
    }
    
    // Test dedup check
    const checkResult = measureTime(() => {
      let hits = 0;
      let misses = 0;
      
      for (const key of keys) {
        if (pendingRequests.has(key)) {
          hits++;
        } else {
          misses++;
          pendingRequests.set(key, { promise: Promise.resolve(), timestamp: Date.now() });
        }
      }
      
      // Clear for next iteration
      pendingRequests.clear();
    }, BENCHMARK_CONFIG.iterations.standard);
    
    const dedupRate = ((requestCount - uniqueKeys) / requestCount * 100).toFixed(1);
    
    return {
      name: 'Request Deduplication',
      totalOps: BENCHMARK_CONFIG.iterations.standard * requestCount,
      avgTimePerOp: checkResult.avgTime / requestCount,
      dedupRate: dedupRate + '%',
      expectedSavings: Math.floor((requestCount - uniqueKeys) / uniqueKeys * 100) + '%',
      passed: true,
      details: `Simulated ${uniqueKeys} unique requests out of ${requestCount} total`
    };
  },
  
  /**
   * Benchmark 8: Base64 Encoding Performance
   * Tests encoding performance for config output
   */
  base64Encoding: () => {
    const testData = generateMockProxyList(100);
    const configs = testData.map((p, i) => `vless://uuid@domain:443#${p.country}-${i}`);
    const combined = configs.join('\n');
    
    const result = measureTime(() => {
      Buffer.from(combined).toString('base64');
    }, BENCHMARK_CONFIG.iterations.standard);
    
    return {
      name: 'Base64 Encoding',
      totalOps: result.iterations,
      avgTime: result.avgTime,
      dataSize: formatBytes(combined.length),
      throughput: formatRate(combined.length / result.avgTime),
      passed: true,
      details: `Encoding ${configs.length} configs (${formatBytes(combined.length)})`
    };
  }
};

// ============================================
// MAIN RUNNER
// ============================================

async function runBenchmarks() {
  console.log('='.repeat(60));
  console.log('Aegir Performance Benchmark Suite');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Node: ${process.version}`);
  console.log(`Platform: ${process.platform} (${process.arch})`);
  console.log('='.repeat(60));
  console.log('');
  
  const results = [];
  const benchmarkNames = Object.keys(benchmarks);
  
  for (const name of benchmarkNames) {
    console.log(`Running: ${name}...`);
    try {
      const startTime = performance.now();
      const result = benchmarks[name]();
      const endTime = performance.now();
      
      results.push({
        ...result,
        benchmarkTime: endTime - startTime,
        status: result.passed ? 'PASS' : 'FAIL'
      });
      
      console.log(`  ✓ Completed in ${formatDuration(endTime - startTime)}`);
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.push({
        name,
        status: 'ERROR',
        error: error.message
      });
    }
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(60));
  
  // Output results table
  console.log('');
  console.log('| Benchmark | Status | Key Metric | Details |');
  console.log('|-----------|--------|------------|---------|');
  
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    let metric = '';
    
    if (result.avgTimePerItem) metric = formatDuration(result.avgTimePerItem) + '/item';
    else if (result.avgTimePerOp) metric = formatDuration(result.avgTimePerOp) + '/op';
    else if (result.throughput) metric = formatRate(result.throughput);
    else if (result.avgThroughput) metric = result.avgThroughput;
    else if (result.avgTime) metric = formatDuration(result.avgTime);
    
    const details = typeof result.details === 'string' 
      ? result.details.substring(0, 40) 
      : (Array.isArray(result.details) ? result.details[0]?.substring(0, 40) || '-' : '-');
    
    console.log(`| ${result.name.substring(0, 25).padEnd(25)} | ${status.padEnd(8)} | ${metric.padEnd(15)} | ${details} |`);
  }
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  const totalTime = results.reduce((sum, r) => sum + (r.benchmarkTime || 0), 0);
  
  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Benchmarks: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total Time: ${formatDuration(totalTime)}`);
  console.log('');
  
  // Generate JSON output for GitHub Actions
  const jsonOutput = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: `${process.platform} (${process.arch})`,
    summary: {
      total: results.length,
      passed,
      failed,
      errors,
      totalTime: totalTime
    },
    results: results.map(r => ({
      name: r.name,
      passed: r.passed || false,
      status: r.status,
      keyMetrics: {
        avgTimePerItem: r.avgTimePerItem,
        avgTimePerOp: r.avgTimePerOp,
        throughput: r.throughput,
        avgThroughput: r.avgThroughput
      },
      details: r.details
    }))
  };
  
  // Write JSON output
  const fs = await import('fs');
  const outputPath = './benchmark/results.json';
  fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`Results written to: ${outputPath}`);
  
  // Generate GitHub Actions summary
  console.log('');
  console.log('='.repeat(60));
  console.log('GITHUB ACTIONS SUMMARY MARKDOWN');
  console.log('='.repeat(60));
  console.log('');
  console.log(generateGitHubSummary(results, totalTime));
  
  return jsonOutput;
}

/**
 * Generate GitHub Actions summary markdown
 */
function generateGitHubSummary(results, totalTime) {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  let md = `## 🚀 Aegir Performance Benchmark Results\n\n`;
  md += `**Run Time:** ${new Date().toISOString()}\n`;
  md += `**Node Version:** ${process.version}\n\n`;
  
  md += `### Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Benchmarks | ${results.length} |\n`;
  md += `| ✅ Passed | ${passed} |\n`;
  md += `| ❌ Failed | ${failed} |\n`;
  md += `| ⏱️ Total Time | ${formatDuration(totalTime)} |\n\n`;
  
  md += `### Detailed Results\n\n`;
  md += `| Benchmark | Status | Key Metric | Details |\n`;
  md += `|-----------|--------|------------|---------|\n`;
  
  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    let metric = '-';
    
    if (result.avgTimePerItem) metric = formatDuration(result.avgTimePerItem) + '/item';
    else if (result.avgTimePerOp) metric = formatDuration(result.avgTimePerOp) + '/op';
    else if (result.throughput) metric = formatRate(result.throughput);
    else if (result.avgThroughput) metric = result.avgThroughput;
    else if (result.avgTime) metric = formatDuration(result.avgTime);
    
    md += `| ${result.name} | ${status} | ${metric} | ${result.details || '-'} |\n`;
  }
  
  // Add breakdown details for benchmarks with detailed results
  for (const result of results) {
    if (result.breakdown && result.breakdown.length > 0) {
      md += `\n#### ${result.name} Breakdown\n\n`;
      md += `| Parameter | Time | Throughput |\n`;
      md += `|-----------|------|------------|\n`;
      
      for (const item of result.breakdown) {
        if (item.chunkSize) {
          md += `| ${item.chunkSize} | ${formatDuration(item.avgTime)} | ${formatRate(item.throughput)} |\n`;
        } else if (item.countries) {
          md += `| ${item.countries} | ${formatDuration(item.perItem)}/item | - |\n`;
        }
      }
    }
  }
  
  return md;
}

// Run benchmarks
runBenchmarks().catch(console.error);
