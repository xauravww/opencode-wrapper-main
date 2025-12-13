import 'dotenv/config';
import { test, describe } from 'node:test';
import assert from 'node:assert';

// Simple tests for the wrapper
describe('OpenCode Wrapper', () => {
  test('should have basic structure', () => {
    assert.ok(true, 'Test framework is working');
  });

  test('should validate environment variables', () => {
    // Check if required env vars are set
    assert.ok(process.env.ZEN_BASE_URL, 'ZEN_BASE_URL should be set');
    assert.ok(process.env.ZEN_API_KEY, 'ZEN_API_KEY should be set');
    assert.ok(process.env.DEFAULT_MODEL, 'DEFAULT_MODEL should be set');
  });

   test('should parse model string correctly', () => {
     const model = 'anthropic/claude-3-5-sonnet-20241022';
     const [provider, modelId] = model.split('/');
     assert.equal(provider, 'anthropic');
     assert.equal(modelId, 'claude-3-5-sonnet-20241022');
   });

   test('should make API call to chat completions', async () => {
     const response = await fetch('http://localhost:3010/v1/chat/completions', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         model: 'grok-code',
         messages: [{ role: 'user', content: 'Hello, test message' }]
       })
     });

     const result = await response.json();
     console.log('Test API response:', JSON.stringify(result, null, 2));

     if (!response.ok) {
       assert.fail(`API call failed: ${response.status} - ${JSON.stringify(result)}`);
     }

     assert.ok(result.choices, 'Should have choices in response');
     assert.ok(result.choices[0].message, 'Should have message in first choice');
   });
 });