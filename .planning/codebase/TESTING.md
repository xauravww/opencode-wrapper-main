# Testing Patterns

**Analysis Date:** 2026-03-02

## Test Framework

**Runner:**
- Node.js native test runner (`node --test`)
- Version: Built into Node.js (no separate package)
- Config: Defined in `package.json` script: `"test": "node --test"`

**Assertion Library:**
- `node:assert` - Native Node.js assertion module
- Example: `import assert from 'node:assert';`

**Run Commands:**
```bash
npm test                    # Run all tests
node --test                # Run all tests (direct)
node test.js               # Run specific test file
```

## Test File Organization

**Location:**
- Test files are in the project root directory
- Not co-located with source files
- Separate from production code

**Naming Convention:**
- `test*.js` - Main test files: `test.js`, `test_providers.js`, `test_failover_unit.js`
- Script-style test files for specific features: `test_stream.js`, `test_concurrency.js`, `test_dynamic_pricing.js`
- Verification scripts: `verify_image_gen.js`, `verify_refine.js`

**Structure:**
```
/home/saurav/Desktop/yasar/opencode-wrapper-main/
├── test.js                    # Basic wrapper tests
├── test_providers.js         # Provider API tests
├── test_failover_unit.js     # Unit-style failover test
├── test_stream.js            # Stream handling tests
├── test_concurrency.js       # Concurrency tests
├── test_dynamic_pricing.js   # Pricing tests
├── verify_image_gen.js       # Image generation verification
└── verify_refine.js          # Refine capability verification
```

## Test Structure

**Test Suite Organization (Node.js native):**
```javascript
import 'dotenv/config';
import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('OpenCode Wrapper', () => {
  test('should have basic structure', () => {
    assert.ok(true, 'Test framework is working');
  });
  
  test('should validate environment variables', () => {
    assert.ok(process.env.ZEN_BASE_URL, 'ZEN_BASE_URL should be set');
  });
  
  test('should make API call to chat completions', async () => {
    const response = await fetch('http://localhost:3010/v1/chat/completions', { ... });
    // assertions...
  });
});
```

**Patterns Observed:**

1. **Setup Pattern:**
   - Import `dotenv/config` at the top
   - Create instances of classes being tested: `const manager = new ProviderManager();`
   - Mock dependencies when needed

2. **Teardown Pattern:**
   - Not explicitly defined
   - Tests run in isolation
   - Async cleanup via promises

3. **Assertion Pattern:**
   - `assert.ok(value, message)` - Truthy check
   - `assert.equal(actual, expected)` - Equality check
   - `assert.fail(message)` - Explicit failure

## Mocking

**Framework:** Native Node.js (no mocking library)

**Patterns:**

1. **Method Replacement (Monkey Patching):**
```javascript
// From test_failover_unit.js
const originalMakeRequest = manager.makeRequest.bind(manager);

manager.makeRequest = async (provider, endpoint, options) => {
  attempts++;
  console.log(`📡 Mock Request to ${provider} (Attempt ${attempts})`);
  
  if (attempts <= 2) {
    throw new Error('Simulated failure');
  }
  
  return {
    id: 'mock-response',
    choices: [{ message: { content: 'Success after failover' } }],
    usage: { total_tokens: 10 }
  };
};
```

2. **Object Property Replacement:**
```javascript
manager.providers = {
  provider1: { apiKeys: ['k1'], models: ['m1'] },
  provider2: { apiKeys: ['k2'], models: ['m2'] },
  provider3: { apiKeys: ['k3'], models: ['m3'] }
};
```

**What to Mock:**
- External API calls (HTTP requests)
- Database operations
- Provider manager methods
- Configuration values

**What NOT to Mock:**
- Internal logic being tested
- Simple utility functions

## Fixtures and Factories

**Test Data:**
- Inline test data in test files
- Environment variables via `dotenv/config`
- Example from `test.js`:
```javascript
const model = 'anthropic/claude-3-5-sonnet-20241022';
const [provider, modelId] = model.split('/');
```

**Location:**
- Test data defined within test files
- No separate fixture files
- Environment-specific data in `.env`

## Coverage

**Requirements:** None enforced

**View Coverage:**
- No coverage tool configured
- Manual testing via scripts
- Console output validation

## Test Types

**Unit Tests:**
- Limited in this codebase
- `test_failover_unit.js` tests ProviderManager logic
- Focus on internal method behavior with mocks

**Integration Tests:**
- Primary testing approach
- `test_providers.js` makes real HTTP calls to provider APIs
- `test.js` tests against running server endpoints
- Tests verify actual API responses

**E2E Tests:**
- Not used
- No Cypress, Playwright, or similar framework

## Common Patterns

**Async Testing:**
```javascript
test('should make API call', async () => {
  const response = await fetch('http://localhost:3010/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ... })
  });
  
  const result = await response.json();
  assert.ok(result.choices, 'Should have choices in response');
});
```

**Error Testing:**
```javascript
if (!response.ok) {
  assert.fail(`API call failed: ${response.status} - ${JSON.stringify(result)}`);
}
```

**Sequential Testing:**
```javascript
async function runTests() {
  for (const [providerName, config] of Object.entries(providers)) {
    await testProvider(providerName, config);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between tests
  }
}
```

## Test Scripts vs Test Files

The codebase has two categories of test-related files:

**1. Actual Test Files (`node --test` compatible):**
- `test.js` - Uses `describe()` and `test()` from `node:test`

**2. Verification/Development Scripts:**
- `verify_image_gen.js`, `verify_refine.js` - Manual verification scripts
- `test_stream.js`, `test_dynamic_pricing.js` - Manual test runners
- These are executed directly: `node test_providers.js`

## Environment for Testing

**Required Environment Variables:**
- `ZEN_BASE_URL` - OpenCode API endpoint
- `ZEN_API_KEY` - OpenCode API key
- `DEFAULT_MODEL` - Default model to use
- Server must be running on `localhost:3010` (or configured port)

**Test Configuration:**
- Tests run against live server
- Port configurable via `TEST_PORT` env var (see `test_concurrency.js`)
- API key configurable via `API_KEY` env var

---

*Testing analysis: 2026-03-02*
