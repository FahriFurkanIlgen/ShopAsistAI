/**
 * Comprehensive Test Scenarios for ShopAsistAI
 * Tests: Size matching, gender filtering, context preservation, follow-up questions, edge cases
 */

const http = require('http');

// Test configuration
const CONFIG = {
  hostname: 'localhost',
  port: 3000,
  siteId: 'high5-tr',
  timeout: 30000
};

// Test scenarios organized by category
const TEST_SCENARIOS = {
  sizeMatching: [
    {
      name: 'Exact size match - 28 numara',
      query: '28 numara bebek ayakkabısı',
      history: [],
      expectedSize: '28',
      minResults: 1,
      category: 'SIZE_MATCHING'
    },
    {
      name: 'Exact size match - 35 numara',
      query: '35 numara kadın ayakkabı',
      history: [],
      expectedSize: '35',
      minResults: 1,
      category: 'SIZE_MATCHING'
    },
    {
      name: 'Size with decimal - 27.5 numara',
      query: '27.5 numara spor ayakkabı',
      history: [],
      expectedSize: '27.5',
      minResults: 0,
      category: 'SIZE_MATCHING'
    },
    {
      name: 'Multiple size mentions',
      query: '28 veya 29 numara çocuk ayakkabısı',
      history: [],
      expectedSize: ['28', '29'],
      minResults: 1,
      category: 'SIZE_MATCHING'
    }
  ],

  genderFiltering: [
    {
      name: 'Girl shoes - explicit',
      query: '28 numara kız ayakkabısı',
      history: [],
      expectedGender: 'Kız',
      minResults: 1,
      category: 'GENDER_FILTERING'
    },
    {
      name: 'Boy shoes - explicit',
      query: '28 numara erkek çocuk ayakkabısı',
      history: [],
      expectedGender: 'Erkek Çocuk',
      minResults: 1,
      category: 'GENDER_FILTERING'
    },
    {
      name: 'Women shoes',
      query: '38 numara kadın spor ayakkabı',
      history: [],
      expectedGender: 'Kadın',
      minResults: 1,
      category: 'GENDER_FILTERING'
    },
    {
      name: 'Men shoes',
      query: '42 numara erkek koşu ayakkabısı',
      history: [],
      expectedGender: 'Erkek',
      minResults: 1,
      category: 'GENDER_FILTERING'
    }
  ],

  contextPreservation: [
    {
      name: 'Context: Size + Category preserved',
      query: 'erkek çocuğu için var mı',
      history: [
        {
          role: 'user',
          content: '28 numara bebek ayakkabısı kız ışıklı',
          timestamp: new Date('2024-01-01T10:00:00Z')
        }
      ],
      expectedSize: '28',
      expectedGender: 'Erkek Çocuk',
      expectContextEnhancement: true,
      minResults: 1,
      category: 'CONTEXT_PRESERVATION'
    },
    {
      name: 'Context: Color modification',
      query: 'beyaz olsun',
      history: [
        {
          role: 'user',
          content: '35 numara kadın spor ayakkabı',
          timestamp: new Date('2024-01-01T10:00:00Z')
        }
      ],
      expectedSize: '35',
      expectedColor: 'beyaz',
      expectContextEnhancement: true,
      minResults: 1,
      category: 'CONTEXT_PRESERVATION'
    },
    {
      name: 'Context: Multiple turns',
      query: 'pembe var mı',
      history: [
        {
          role: 'user',
          content: '28 numara kız ayakkabısı',
          timestamp: new Date('2024-01-01T10:00:00Z')
        },
        {
          role: 'assistant',
          content: '5 ürün buldum',
          timestamp: new Date('2024-01-01T10:00:01Z')
        },
        {
          role: 'user',
          content: 'ışıklı olanlarını göster',
          timestamp: new Date('2024-01-01T10:00:02Z')
        }
      ],
      expectedSize: '28',
      expectedGender: 'Kız',
      expectContextEnhancement: true,
      minResults: 0,
      category: 'CONTEXT_PRESERVATION'
    }
  ],

  followUpQuestions: [
    {
      name: 'Follow-up: Gender change',
      query: 'erkek için var mı',
      history: [
        {
          role: 'user',
          content: '30 numara kız ayakkabısı',
          timestamp: new Date('2024-01-01T10:00:00Z')
        }
      ],
      expectedSize: '30',
      expectedGender: 'Erkek',
      expectContextEnhancement: true,
      minResults: 0,
      category: 'FOLLOW_UP'
    },
    {
      name: 'Follow-up: Price question',
      query: 'fiyatı ne kadar',
      history: [
        {
          role: 'user',
          content: '28 numara ışıklı ayakkabı',
          timestamp: new Date('2024-01-01T10:00:00Z')
        }
      ],
      expectContextEnhancement: false,
      minResults: 0,
      category: 'FOLLOW_UP'
    },
    {
      name: 'Follow-up: Feature question',
      query: 'su geçirmez var mı',
      history: [
        {
          role: 'user',
          content: '35 numara kadın bot',
          timestamp: new Date('2024-01-01T10:00:00Z')
        }
      ],
      expectedSize: '35',
      expectContextEnhancement: true,
      minResults: 0,
      category: 'FOLLOW_UP'
    }
  ],

  specialFeatures: [
    {
      name: 'LED lights feature',
      query: '28 numara ışıklı ayakkabı',
      history: [],
      expectedFeature: 'ışıklı',
      minResults: 1,
      category: 'SPECIAL_FEATURES'
    },
    {
      name: 'Waterproof feature',
      query: '40 numara su geçirmez bot',
      history: [],
      expectedFeature: 'su geçirmez',
      minResults: 0,
      category: 'SPECIAL_FEATURES'
    },
    {
      name: 'Sport category',
      query: '42 numara erkek koşu ayakkabısı',
      history: [],
      expectedCategory: 'koşu',
      minResults: 1,
      category: 'SPECIAL_FEATURES'
    }
  ],

  colorFiltering: [
    {
      name: 'Black color',
      query: '35 numara siyah ayakkabı',
      history: [],
      expectedColor: 'siyah',
      minResults: 1,
      category: 'COLOR_FILTERING'
    },
    {
      name: 'White color',
      query: '38 numara beyaz spor ayakkabı',
      history: [],
      expectedColor: 'beyaz',
      minResults: 1,
      category: 'COLOR_FILTERING'
    },
    {
      name: 'Pink color - child',
      query: '28 numara pembe kız ayakkabısı',
      history: [],
      expectedColor: 'pembe',
      minResults: 1,
      category: 'COLOR_FILTERING'
    }
  ],

  edgeCases: [
    {
      name: 'No size specified',
      query: 'erkek spor ayakkabı',
      history: [],
      minResults: 1,
      category: 'EDGE_CASE'
    },
    {
      name: 'Invalid size - too small',
      query: '10 numara ayakkabı',
      history: [],
      minResults: 0,
      category: 'EDGE_CASE'
    },
    {
      name: 'Invalid size - too large',
      query: '60 numara ayakkabı',
      history: [],
      minResults: 0,
      category: 'EDGE_CASE'
    },
    {
      name: 'Empty query',
      query: '',
      history: [],
      shouldFail: true,
      category: 'EDGE_CASE'
    },
    {
      name: 'Very long query',
      query: '28 numara çocuk ayakkabısı ışıklı su geçirmez siyah erkek çocuk için spor koşu günlük kullanım rahat hafif nefes alabilen kaliteli marka',
      history: [],
      minResults: 0,
      category: 'EDGE_CASE'
    },
    {
      name: 'Turkish character handling',
      query: '28 numara çocuk ayakkabısı ışıklı',
      history: [],
      minResults: 1,
      category: 'EDGE_CASE'
    },
    {
      name: 'Mixed case query',
      query: '28 NUMARA Bebek AyakKabısı',
      history: [],
      minResults: 1,
      category: 'EDGE_CASE'
    }
  ],

  performance: [
    {
      name: 'Response time - simple query',
      query: '28 numara ayakkabı',
      history: [],
      maxResponseTime: 2000,
      category: 'PERFORMANCE'
    },
    {
      name: 'Response time - complex query with context',
      query: 'erkek için var mı',
      history: [
        {
          role: 'user',
          content: '28 numara bebek ayakkabısı kız ışıklı su geçirmez siyah',
          timestamp: new Date('2024-01-01T10:00:00Z')
        }
      ],
      maxResponseTime: 3000,
      category: 'PERFORMANCE'
    }
  ]
};

// HTTP request helper
function makeRequest(message, conversationHistory = []) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      siteId: CONFIG.siteId,
      message,
      conversationHistory
    });

    const options = {
      hostname: CONFIG.hostname,
      port: CONFIG.port,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data, 'utf8')
      },
      timeout: CONFIG.timeout
    };

    const startTime = Date.now();

    const req = http.request(options, (res) => {
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        try {
          const response = JSON.parse(responseBody);
          resolve({ 
            response, 
            responseTime,
            statusCode: res.statusCode 
          });
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(data);
    req.end();
  });
}

// Test assertion helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertSize(products, expectedSize) {
  if (Array.isArray(expectedSize)) {
    const sizes = products.map(p => p.size);
    const hasAnyExpectedSize = expectedSize.some(size => sizes.includes(size));
    assert(hasAnyExpectedSize, `Expected one of sizes [${expectedSize.join(', ')}], got: [${sizes.slice(0, 3).join(', ')}]`);
  } else {
    const wrongSize = products.find(p => p.size !== expectedSize);
    assert(!wrongSize, `Expected size ${expectedSize}, but found ${wrongSize?.size} in product ${wrongSize?.id}`);
  }
}

function assertGender(products, expectedGender) {
  const normalizedExpected = expectedGender.toLowerCase();
  const wrongGender = products.find(p => {
    const normalizedGender = (p.gender || '').toLowerCase();
    return !normalizedGender.includes(normalizedExpected);
  });
  assert(!wrongGender, `Expected gender containing "${expectedGender}", but found "${wrongGender?.gender}" in product ${wrongGender?.title}`);
}

function assertMinResults(products, minResults) {
  assert(products.length >= minResults, `Expected at least ${minResults} products, got ${products.length}`);
}

function assertContextEnhancement(debug, shouldBeEnhanced) {
  assert(debug.isFollowUp === shouldBeEnhanced, 
    `Expected isFollowUp=${shouldBeEnhanced}, got ${debug.isFollowUp}`);
  
  if (shouldBeEnhanced) {
    assert(debug.enhancedQuery !== debug.originalQuery,
      `Expected query to be enhanced, but they are the same: "${debug.originalQuery}"`);
  }
}

function assertResponseTime(responseTime, maxTime) {
  assert(responseTime <= maxTime, 
    `Response time ${responseTime}ms exceeds maximum ${maxTime}ms`);
}

// Run single test
async function runTest(testName, testCase) {
  const startTime = Date.now();
  
  try {
    const { response, responseTime, statusCode } = await makeRequest(
      testCase.query,
      testCase.history
    );

    // Check if test expects failure
    if (testCase.shouldFail) {
      if (statusCode >= 400) {
        return { 
          passed: true, 
          duration: Date.now() - startTime,
          message: 'Failed as expected'
        };
      } else {
        throw new Error('Expected request to fail but it succeeded');
      }
    }

    // Validate response structure
    assert(response.message, 'Response should have message');
    assert(response.debug, 'Response should have debug info');
    
    const products = response.recommendedProducts || [];

    // Run assertions based on test case expectations
    if (testCase.expectedSize) {
      assertSize(products, testCase.expectedSize);
    }

    if (testCase.expectedGender && products.length > 0) {
      assertGender(products, testCase.expectedGender);
    }

    if (testCase.minResults !== undefined) {
      assertMinResults(products, testCase.minResults);
    }

    if (testCase.expectContextEnhancement !== undefined) {
      assertContextEnhancement(response.debug, testCase.expectContextEnhancement);
    }

    if (testCase.maxResponseTime) {
      assertResponseTime(responseTime, testCase.maxResponseTime);
    }

    return {
      passed: true,
      duration: Date.now() - startTime,
      responseTime,
      productCount: products.length,
      debug: response.debug
    };

  } catch (error) {
    return {
      passed: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

// Run all tests in a category
async function runCategory(categoryName, tests) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📁 Category: ${categoryName}`);
  console.log('='.repeat(70));

  const results = [];

  for (const test of tests) {
    process.stdout.write(`  ⏳ ${test.name}... `);
    
    const result = await runTest(test.name, test);
    results.push({ ...result, name: test.name, category: test.category });

    if (result.passed) {
      console.log(`✅ PASS (${result.duration}ms)`);
      if (result.debug) {
        console.log(`     Query: "${result.debug.originalQuery}" → "${result.debug.enhancedQuery}"`);
        console.log(`     Products: ${result.productCount}, Follow-up: ${result.debug.isFollowUp}`);
      }
    } else {
      console.log(`❌ FAIL (${result.duration}ms)`);
      console.log(`     Error: ${result.error}`);
    }
  }

  return results;
}

// Generate summary report
function generateReport(allResults) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY REPORT');
  console.log('='.repeat(70));

  const total = allResults.length;
  const passed = allResults.filter(r => r.passed).length;
  const failed = total - passed;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Pass Rate: ${passRate}%`);

  // Group by category
  const byCategory = {};
  allResults.forEach(r => {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { passed: 0, failed: 0, total: 0 };
    }
    byCategory[r.category].total++;
    if (r.passed) {
      byCategory[r.category].passed++;
    } else {
      byCategory[r.category].failed++;
    }
  });

  console.log('\n📁 Results by Category:');
  Object.entries(byCategory).forEach(([category, stats]) => {
    const rate = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`  ${category}: ${stats.passed}/${stats.total} (${rate}%)`);
  });

  // Performance stats
  const responseTimes = allResults
    .filter(r => r.responseTime)
    .map(r => r.responseTime);
  
  if (responseTimes.length > 0) {
    const avgResponseTime = (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(0);
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);

    console.log('\n⚡ Performance Metrics:');
    console.log(`  Average Response Time: ${avgResponseTime}ms`);
    console.log(`  Min Response Time: ${minResponseTime}ms`);
    console.log(`  Max Response Time: ${maxResponseTime}ms`);
  }

  // Failed tests details
  const failedTests = allResults.filter(r => !r.passed);
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTests.forEach(test => {
      console.log(`  - ${test.name}`);
      console.log(`    Error: ${test.error}`);
    });
  }

  console.log('\n' + '='.repeat(70));

  return {
    total,
    passed,
    failed,
    passRate: parseFloat(passRate),
    byCategory,
    responseTimes: {
      avg: responseTimes.length > 0 ? parseFloat(avgResponseTime) : 0,
      min: responseTimes.length > 0 ? minResponseTime : 0,
      max: responseTimes.length > 0 ? maxResponseTime : 0
    }
  };
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting ShopAsistAI Test Suite');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🔗 Target: ${CONFIG.hostname}:${CONFIG.port}`);

  const allResults = [];

  try {
    // Run each category
    for (const [categoryName, tests] of Object.entries(TEST_SCENARIOS)) {
      const results = await runCategory(categoryName, tests);
      allResults.push(...results);
    }

    // Generate report
    const report = generateReport(allResults);

    // Save results to file
    const fs = require('fs');
    const reportPath = `./tests/test-results-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      config: CONFIG,
      summary: report,
      details: allResults
    }, null, 2));

    console.log(`\n💾 Results saved to: ${reportPath}`);

    // Exit with appropriate code
    process.exit(report.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  TEST_SCENARIOS,
  runAllTests,
  runTest,
  makeRequest
};
