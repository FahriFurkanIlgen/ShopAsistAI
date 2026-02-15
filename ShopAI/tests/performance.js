/**
 * Performance Profiler and Benchmarking Tool
 * Measures search performance, memory usage, and system health
 */

const http = require('http');

const CONFIG = {
  hostname: 'localhost',
  port: 3000,
  siteId: 'skechers-tr'
};

// Benchmark queries representing different complexity levels
const BENCHMARK_QUERIES = [
  { name: 'Simple size query', query: '28 numara', complexity: 'low' },
  { name: 'Size + gender', query: '35 numara kadın', complexity: 'low' },
  { name: 'Size + gender + category', query: '28 numara kız ayakkabısı', complexity: 'medium' },
  { name: 'Size + gender + feature', query: '28 numara kız ışıklı ayakkabı', complexity: 'medium' },
  { name: 'Complex query', query: '35 numara kadın spor ayakkabı beyaz', complexity: 'high' },
  { name: 'Very complex query', query: '28 numara erkek çocuk ayakkabısı ışıklı su geçirmez siyah', complexity: 'high' }
];

function makeRequest(query, history = []) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      siteId: CONFIG.siteId,
      message: query,
      conversationHistory: history
    });

    const options = {
      hostname: CONFIG.hostname,
      port: CONFIG.port,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data, 'utf8')
      }
    };

    const startTime = Date.now();

    const req = http.request(options, (res) => {
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        
        try {
          const response = JSON.parse(responseBody);
          resolve({
            response,
            responseTime: endTime - startTime,
            statusCode: res.statusCode
          });
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function checkHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: CONFIG.hostname,
      port: CONFIG.port,
      path: '/health',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        try {
          const health = JSON.parse(responseBody);
          resolve(health);
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runBenchmark(iterations = 3) {
  console.log('⚡ Performance Benchmark');
  console.log('='.repeat(70));
  console.log(`Iterations per query: ${iterations}`);
  console.log('');

  const results = [];

  for (const benchmark of BENCHMARK_QUERIES) {
    process.stdout.write(`Testing: ${benchmark.name}... `);

    const times = [];
    let lastResponse = null;

    for (let i = 0; i < iterations; i++) {
      try {
        const { response, responseTime } = await makeRequest(benchmark.query);
        times.push(responseTime);
        lastResponse = response;
      } catch (e) {
        console.log(`❌ Failed: ${e.message}`);
        break;
      }
    }

    if (times.length === iterations) {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const productCount = lastResponse?.recommendedProducts?.length || 0;

      results.push({
        name: benchmark.name,
        query: benchmark.query,
        complexity: benchmark.complexity,
        avgTime: avg,
        minTime: min,
        maxTime: max,
        productCount
      });

      console.log(`✓ Avg: ${avg.toFixed(0)}ms (${min}-${max}ms)`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 Benchmark Results Summary\n');

  // Group by complexity
  const byComplexity = {
    low: results.filter(r => r.complexity === 'low'),
    medium: results.filter(r => r.complexity === 'medium'),
    high: results.filter(r => r.complexity === 'high')
  };

  Object.entries(byComplexity).forEach(([complexity, items]) => {
    if (items.length === 0) return;
    
    const avgTime = items.reduce((sum, item) => sum + item.avgTime, 0) / items.length;
    console.log(`${complexity.toUpperCase()} Complexity: ${avgTime.toFixed(0)}ms average`);
    items.forEach(item => {
      console.log(`  - ${item.name}: ${item.avgTime.toFixed(0)}ms (${item.productCount} products)`);
    });
    console.log('');
  });

  // Overall stats
  const overallAvg = results.reduce((sum, r) => sum + r.avgTime, 0) / results.length;
  const overallMin = Math.min(...results.map(r => r.minTime));
  const overallMax = Math.max(...results.map(r => r.maxTime));

  console.log('Overall Performance:');
  console.log(`  Average: ${overallAvg.toFixed(0)}ms`);
  console.log(`  Fastest: ${overallMin}ms`);
  console.log(`  Slowest: ${overallMax}ms`);

  return results;
}

async function runLoadTest(duration = 10, concurrency = 5) {
  console.log('\n⚡ Load Test');
  console.log('='.repeat(70));
  console.log(`Duration: ${duration} seconds`);
  console.log(`Concurrency: ${concurrency} requests`);
  console.log('');

  const queries = BENCHMARK_QUERIES.map(b => b.query);
  const startTime = Date.now();
  const endTime = startTime + (duration * 1000);
  
  let completed = 0;
  let failed = 0;
  const responseTimes = [];

  async function worker() {
    while (Date.now() < endTime) {
      const query = queries[Math.floor(Math.random() * queries.length)];
      
      try {
        const { responseTime } = await makeRequest(query);
        responseTimes.push(responseTime);
        completed++;
      } catch (e) {
        failed++;
      }
    }
  }

  // Start workers
  const workers = Array(concurrency).fill(null).map(() => worker());
  
  // Progress indicator
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(100, (elapsed / (duration * 1000)) * 100);
    process.stdout.write(`\rProgress: ${progress.toFixed(0)}% | Completed: ${completed} | Failed: ${failed}`);
  }, 500);

  await Promise.all(workers);
  clearInterval(progressInterval);

  console.log('\n\n📊 Load Test Results:\n');
  console.log(`Total Requests: ${completed + failed}`);
  console.log(`Successful: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((completed / (completed + failed)) * 100).toFixed(1)}%`);
  console.log(`Requests/sec: ${(completed / duration).toFixed(2)}`);

  if (responseTimes.length > 0) {
    const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const sorted = responseTimes.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    console.log('\nResponse Times:');
    console.log(`  Average: ${avg.toFixed(0)}ms`);
    console.log(`  Median (p50): ${p50}ms`);
    console.log(`  p95: ${p95}ms`);
    console.log(`  p99: ${p99}ms`);
    console.log(`  Min: ${sorted[0]}ms`);
    console.log(`  Max: ${sorted[sorted.length - 1]}ms`);
  }

  return {
    total: completed + failed,
    completed,
    failed,
    successRate: (completed / (completed + failed)) * 100,
    requestsPerSecond: completed / duration,
    responseTimes: {
      avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes)
    }
  };
}

async function systemHealthCheck() {
  console.log('\n🏥 System Health Check');
  console.log('='.repeat(70));

  try {
    const health = await checkHealth();
    
    console.log('\n✅ Server Status: UP');
    console.log(`Version: ${health.version || 'N/A'}`);
    console.log(`Environment: ${health.environment || 'N/A'}`);
    console.log(`Uptime: ${health.uptime || 'N/A'}`);

    if (health.cache) {
      console.log('\n📦 Cache Status:');
      console.log(`  Sites: ${health.cache.keys || 0}`);
      console.log(`  Hits: ${health.cache.hits || 'N/A'}`);
      console.log(`  Misses: ${health.cache.misses || 'N/A'}`);
      
      if (health.cache.hits && health.cache.misses) {
        const hitRate = (health.cache.hits / (health.cache.hits + health.cache.misses) * 100).toFixed(1);
        console.log(`  Hit Rate: ${hitRate}%`);
      }
    }

    if (health.memory) {
      console.log('\n💾 Memory Usage:');
      console.log(`  RSS: ${(health.memory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Used: ${(health.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Total: ${(health.memory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    }

    return health;

  } catch (e) {
    console.log('\n❌ Server Status: DOWN');
    console.log(`Error: ${e.message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'benchmark';

  console.log('⚡ ShopAsistAI Performance Profiler');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log('');

  // Always check health first
  await systemHealthCheck();

  if (command === 'benchmark') {
    const iterations = parseInt(args[1]) || 3;
    await runBenchmark(iterations);
  } else if (command === 'load') {
    const duration = parseInt(args[1]) || 10;
    const concurrency = parseInt(args[2]) || 5;
    await runLoadTest(duration, concurrency);
  } else if (command === 'health') {
    // Already done above
  } else if (command === 'full') {
    await runBenchmark(3);
    await runLoadTest(10, 5);
  } else {
    console.log('\nUsage:');
    console.log('  node performance.js benchmark [iterations]  - Run benchmark (default: 3)');
    console.log('  node performance.js load [duration] [conc]   - Run load test (default: 10s, 5 concurrent)');
    console.log('  node performance.js health                   - Health check only');
    console.log('  node performance.js full                     - Run all tests');
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Profiling complete');
}

if (require.main === module) {
  main().catch(err => {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  runBenchmark,
  runLoadTest,
  systemHealthCheck
};
