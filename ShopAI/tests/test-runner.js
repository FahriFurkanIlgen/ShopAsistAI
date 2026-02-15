/**
 * Quick Test Runner for Development
 * Run specific test categories or individual tests
 */

const { TEST_SCENARIOS, runTest, makeRequest } = require('./test-scenarios');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

async function quickTest() {
  console.log(colorize('🧪 Quick Test Mode', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));

  // Test 1: Basic size matching
  console.log('\n' + colorize('Test 1: Size Matching', 'blue'));
  try {
    const { response } = await makeRequest('28 numara bebek ayakkabısı');
    console.log(colorize(`✓ Found ${response.recommendedProducts?.length || 0} products`, 'green'));
    console.log(`  Sizes: ${response.recommendedProducts?.slice(0, 3).map(p => p.size).join(', ')}`);
  } catch (e) {
    console.log(colorize(`✗ Error: ${e.message}`, 'red'));
  }

  // Test 2: Gender filtering
  console.log('\n' + colorize('Test 2: Gender Filtering', 'blue'));
  try {
    const { response } = await makeRequest('28 numara kız ayakkabısı ışıklı');
    console.log(colorize(`✓ Found ${response.recommendedProducts?.length || 0} products`, 'green'));
    console.log(`  Genders: ${response.recommendedProducts?.slice(0, 3).map(p => p.gender).join(', ')}`);
  } catch (e) {
    console.log(colorize(`✗ Error: ${e.message}`, 'red'));
  }

  // Test 3: Context preservation
  console.log('\n' + colorize('Test 3: Context Preservation', 'blue'));
  try {
    const history = [{
      role: 'user',
      content: '28 numara bebek ayakkabısı kız ışıklı',
      timestamp: new Date('2024-01-01T10:00:00Z')
    }];
    const { response } = await makeRequest('erkek çocuğu için var mı', history);
    console.log(colorize(`✓ Context detected: ${response.debug?.isFollowUp}`, 'green'));
    console.log(`  Original: "${response.debug?.originalQuery}"`);
    console.log(`  Enhanced: "${response.debug?.enhancedQuery}"`);
    console.log(`  Products: ${response.recommendedProducts?.length || 0}`);
  } catch (e) {
    console.log(colorize(`✗ Error: ${e.message}`, 'red'));
  }

  // Test 4: Performance
  console.log('\n' + colorize('Test 4: Performance', 'blue'));
  const start = Date.now();
  try {
    await makeRequest('35 numara kadın spor ayakkabı');
    const duration = Date.now() - start;
    const status = duration < 2000 ? 'green' : 'yellow';
    console.log(colorize(`✓ Response time: ${duration}ms`, status));
  } catch (e) {
    console.log(colorize(`✗ Error: ${e.message}`, 'red'));
  }

  console.log('\n' + colorize('=' .repeat(50), 'cyan'));
  console.log(colorize('✅ Quick test complete', 'green'));
}

async function runCategory(categoryName) {
  const tests = TEST_SCENARIOS[categoryName];
  if (!tests) {
    console.log(colorize(`❌ Category "${categoryName}" not found`, 'red'));
    console.log('\nAvailable categories:');
    Object.keys(TEST_SCENARIOS).forEach(cat => console.log(`  - ${cat}`));
    return;
  }

  console.log(colorize(`\n📁 Running category: ${categoryName}`, 'cyan'));
  console.log(colorize('='.repeat(60), 'cyan'));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    process.stdout.write(`  ${test.name}... `);
    const result = await runTest(test.name, test);
    
    if (result.passed) {
      console.log(colorize(`✓ (${result.duration}ms)`, 'green'));
      passed++;
    } else {
      console.log(colorize(`✗ (${result.duration}ms)`, 'red'));
      console.log(colorize(`    ${result.error}`, 'red'));
      failed++;
    }
  }

  console.log('\n' + colorize(`Results: ${passed} passed, ${failed} failed`, passed === tests.length ? 'green' : 'yellow'));
}

async function runSingle(categoryName, testIndex) {
  const tests = TEST_SCENARIOS[categoryName];
  if (!tests) {
    console.log(colorize(`❌ Category "${categoryName}" not found`, 'red'));
    return;
  }

  const test = tests[testIndex];
  if (!test) {
    console.log(colorize(`❌ Test index ${testIndex} not found in category "${categoryName}"`, 'red'));
    console.log(`Available tests (0-${tests.length - 1}):`);
    tests.forEach((t, i) => console.log(`  ${i}: ${t.name}`));
    return;
  }

  console.log(colorize(`\n🧪 Running test: ${test.name}`, 'cyan'));
  console.log(colorize('='.repeat(60), 'cyan'));
  console.log(`Query: "${test.query}"`);
  if (test.history && test.history.length > 0) {
    console.log(`History: ${test.history.length} message(s)`);
  }

  const result = await runTest(test.name, test);

  if (result.passed) {
    console.log('\n' + colorize('✅ TEST PASSED', 'green'));
    console.log(`Duration: ${result.duration}ms`);
    if (result.debug) {
      console.log('\nDebug Info:');
      console.log(`  Original Query: "${result.debug.originalQuery}"`);
      console.log(`  Enhanced Query: "${result.debug.enhancedQuery}"`);
      console.log(`  Is Follow-up: ${result.debug.isFollowUp}`);
      console.log(`  Product Count: ${result.productCount}`);
    }
  } else {
    console.log('\n' + colorize('❌ TEST FAILED', 'red'));
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Error: ${result.error}`);
  }
}

function showHelp() {
  console.log(colorize('\n🧪 Test Runner Usage', 'cyan'));
  console.log(colorize('='.repeat(60), 'cyan'));
  console.log('\nCommands:');
  console.log('  node test-runner.js                    - Run quick tests');
  console.log('  node test-runner.js list               - List all categories');
  console.log('  node test-runner.js <category>         - Run specific category');
  console.log('  node test-runner.js <category> <index> - Run specific test');
  console.log('\nExamples:');
  console.log('  node test-runner.js sizeMatching');
  console.log('  node test-runner.js contextPreservation 0');
  console.log('\nCategories:');
  Object.keys(TEST_SCENARIOS).forEach(cat => {
    console.log(`  - ${cat} (${TEST_SCENARIOS[cat].length} tests)`);
  });
}

function listCategories() {
  console.log(colorize('\n📚 Available Test Categories', 'cyan'));
  console.log(colorize('='.repeat(60), 'cyan'));
  
  Object.entries(TEST_SCENARIOS).forEach(([name, tests]) => {
    console.log(`\n${colorize(name, 'blue')} (${tests.length} tests)`);
    tests.forEach((test, i) => {
      console.log(`  ${i}: ${test.name}`);
    });
  });
}

// CLI handler
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await quickTest();
  } else if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp();
  } else if (args[0] === 'list') {
    listCategories();
  } else if (args.length === 1) {
    await runCategory(args[0]);
  } else if (args.length === 2) {
    await runSingle(args[0], parseInt(args[1]));
  } else {
    showHelp();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(colorize(`\n❌ Fatal error: ${err.message}`, 'red'));
    process.exit(1);
  });
}

module.exports = { quickTest, runCategory, runSingle };
