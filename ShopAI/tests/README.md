# ShopAsistAI Test Suite

Comprehensive testing framework for ShopAsistAI search and conversation features.

## 📁 Test Structure

```
tests/
├── test-scenarios.js    - All test cases organized by category
├── test-runner.js       - Interactive test runner CLI
├── performance.js       - Performance profiling and benchmarking
└── test-results/        - Test execution results (generated)
```

## 🧪 Test Categories

### 1. Size Matching Tests
- Exact size matching (28, 35, 42, etc.)
- Decimal sizes (27.5, 38.5)
- Multiple size queries
- Size extraction from natural language

### 2. Gender Filtering Tests
- Girl shoes (Kız)
- Boy shoes (Erkek Çocuk)
- Women shoes (Kadın)
- Men shoes (Erkek)
- Gender extraction from product type

### 3. Context Preservation Tests
- Follow-up questions maintaining size context
- Follow-up questions with gender change
- Multi-turn conversations
- Context enhancement validation

### 4. Follow-Up Questions Tests
- Gender modifications ("erkek için var mı")
- Color modifications ("beyaz olsun")
- Feature questions ("su geçirmez var mı")
- Price inquiries

### 5. Special Features Tests
- LED lights (ışıklı)
- Waterproof (su geçirmez)
- Category matching (koşu, spor, bot)

### 6. Color Filtering Tests
- Basic colors (siyah, beyaz, pembe, mavi)
- Color combinations
- Turkish character handling

### 7. Edge Cases Tests
- No size specified
- Invalid sizes (too small/large)
- Empty queries
- Very long queries
- Turkish character handling
- Case insensitivity

### 8. Performance Tests
- Response time benchmarks
- Complex query performance
- Context-enhanced query performance

## 🚀 Quick Start

### Run Quick Tests (4 essential tests)
```bash
node tests/test-runner.js
```

### Run All Tests
```bash
node tests/test-scenarios.js
```

### Run Specific Category
```bash
node tests/test-runner.js sizeMatching
node tests/test-runner.js contextPreservation
node tests/test-runner.js genderFiltering
```

### Run Single Test
```bash
node tests/test-runner.js contextPreservation 0
```

### List All Categories
```bash
node tests/test-runner.js list
```

## ⚡ Performance Testing

### Run Benchmark (measures average response times)
```bash
node tests/performance.js benchmark
node tests/performance.js benchmark 5  # 5 iterations
```

### Run Load Test
```bash
node tests/performance.js load
node tests/performance.js load 30 10  # 30 seconds, 10 concurrent
```

### Health Check
```bash
node tests/performance.js health
```

### Full Profile (all tests)
```bash
node tests/performance.js full
```

## 📊 Test Results

Test results are automatically saved to `tests/test-results-{timestamp}.json`:

```json
{
  "timestamp": "2024-01-01T10:00:00.000Z",
  "summary": {
    "total": 45,
    "passed": 42,
    "failed": 3,
    "passRate": 93.3,
    "byCategory": { ... },
    "responseTimes": { ... }
  },
  "details": [ ... ]
}
```

## ✅ Expected Results

### Size Matching
- ✅ Exact size 28 returns only size 28 products
- ✅ Adult sizes (35-45) return adult products
- ✅ Child sizes (20-35) return child products

### Gender Filtering
- ✅ "kız" query returns only girls' products
- ✅ "erkek çocuk" returns boys' products
- ✅ Gender extracted from productType when not explicit

### Context Preservation
- ✅ Follow-up "erkek için var mı" maintains size from previous query
- ✅ Enhanced query combines context: "28 numara bebek ayakkabı ışıklı erkek için var mı"
- ✅ debug.isFollowUp = true for context-enhanced queries

### Performance Benchmarks
- ✅ Simple queries: < 500ms
- ✅ Medium complexity: < 1000ms
- ✅ Complex with context: < 2000ms
- ✅ Average response time: < 1500ms

## 🔧 Writing New Tests

Add tests to `test-scenarios.js` in the appropriate category:

```javascript
{
  name: 'Test description',
  query: 'user query string',
  history: [], // conversation history (optional)
  expectedSize: '28', // or ['28', '29']
  expectedGender: 'Kız',
  expectedColor: 'beyaz',
  expectedFeature: 'ışıklı',
  expectContextEnhancement: true,
  minResults: 1,
  maxResponseTime: 2000,
  shouldFail: false,
  category: 'CATEGORY_NAME'
}
```

## 🐛 Debugging Tests

### Verbose Output
Check test results for:
- `debug.originalQuery` - User's original query
- `debug.enhancedQuery` - Context-enhanced query
- `debug.isFollowUp` - Whether context was applied
- `productCount` - Number of products returned
- `responseTime` - Query execution time

### Failed Tests
Failed tests show:
- Error message
- Expected vs actual values
- Duration before failure

### Server Logs
Backend logs show:
```
[AIService] Original message: "erkek çocuğu için var mı"
[AIService] Search query with context: "28 numara bebek ayakkabı ışıklı erkek çocuğu için var mı"
[AIService] Is follow-up: true
```

## 📈 Metrics to Monitor

### Functional Metrics
- **Pass Rate**: Should be > 90%
- **Size Accuracy**: 100% for exact matches
- **Gender Accuracy**: > 95%
- **Context Detection Rate**: > 90% for follow-ups

### Performance Metrics
- **Average Response Time**: < 1500ms
- **p95 Response Time**: < 3000ms
- **Requests/sec**: > 10 (under load)
- **Success Rate**: > 99%

## 🎯 Test Coverage

Current coverage:
- ✅ Size matching (exact, range, decimal)
- ✅ Gender filtering (all types)
- ✅ Context preservation (multi-turn)
- ✅ Follow-up questions
- ✅ Special features (lights, waterproof)
- ✅ Color filtering
- ✅ Edge cases (invalid input, empty queries)
- ✅ Performance benchmarks

## 🔄 CI/CD Integration

Run tests in CI pipeline:

```bash
# Run all tests and exit with code 1 if any fail
node tests/test-scenarios.js

# Check exit code
if [ $? -ne 0 ]; then
  echo "Tests failed"
  exit 1
fi
```

## 📝 Notes

- Tests require server to be running on `localhost:3000`
- Tests use `skechers-tr` siteId
- Context preservation tests validate `buildSearchQuery()` functionality
- Performance tests measure real response times including AI processing
- Test results include both functional and performance metrics

## 🆘 Troubleshooting

### Server Not Responding
```bash
# Check if server is running
curl http://localhost:3000/health

# Start server
cd backend && npm run dev
```

### Tests Timing Out
- Increase timeout in CONFIG (default: 30s)
- Check server logs for errors
- Verify network connectivity

### Context Tests Failing
- Check `buildSearchQuery()` implementation
- Verify conversation history format
- Check debug output for enhanced queries

## 📚 Related Documentation

- [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md) - Technical implementation details
- [AI_QUERY_PARSER_GUIDE.md](../AI_QUERY_PARSER_GUIDE.md) - Query parsing documentation
- [MERCHANDISING_GUIDE.md](../MERCHANDISING_GUIDE.md) - Search ranking and boosting

---

**Last Updated**: 2026-02-15
**Test Suite Version**: 1.0.0
