import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3010/v1/chat/completions';

// Test models - focusing on key ones
const testModels = [
  'grok-code',           // Zen fallback
  'llama3.1-70b',        // Cerebras
  'claude-3-haiku',      // OpenRouter/Anthropic
  'gpt-4o-mini',         // OpenRouter/OpenAI
  'meta-llama/llama-3.1-405b-instruct' // OpenRouter
];

const testMessage = {
  messages: [{ role: 'user', content: 'Say hello in exactly 3 words.' }],
  max_tokens: 50,
  stream: false
};

async function testModel(model) {
  const startTime = Date.now();
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...testMessage, model })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const responseTime = Date.now() - startTime;

    console.log(`${model}: ${responseTime}ms - "${result.choices[0].message.content.trim()}"`);
    return { model, responseTime, success: true, content: result.choices[0].message.content };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`${model}: ${responseTime}ms - ERROR: ${error.message}`);
    return { model, responseTime, success: false, error: error.message };
  }
}

async function runTests(iterations = 3) {
  console.log(`Running speed tests (${iterations} iterations per model)...\n`);

  const results = {};

  for (const model of testModels) {
    console.log(`Testing ${model}:`);
    results[model] = [];

    for (let i = 0; i < iterations; i++) {
      const result = await testModel(model);
      results[model].push(result);

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Calculate average for this model
    const successful = results[model].filter(r => r.success);
    if (successful.length > 0) {
      const avgTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
      const minTime = Math.min(...successful.map(r => r.responseTime));
      const maxTime = Math.max(...successful.map(r => r.responseTime));
      console.log(`  Average: ${avgTime.toFixed(0)}ms (min: ${minTime}ms, max: ${maxTime}ms, success: ${successful.length}/${iterations})\n`);
    } else {
      console.log(`  No successful requests\n`);
    }
  }

  // Overall summary
  console.log('=== OVERALL SUMMARY ===');
  const modelStats = Object.entries(results).map(([model, tests]) => {
    const successful = tests.filter(t => t.success);
    if (successful.length === 0) return { model, avgTime: Infinity, successRate: 0 };

    const avgTime = successful.reduce((sum, t) => sum + t.responseTime, 0) / successful.length;
    const successRate = successful.length / tests.length;
    return { model, avgTime, successRate };
  });

  modelStats.sort((a, b) => a.avgTime - b.avgTime);

  modelStats.forEach(stat => {
    const timeStr = stat.avgTime === Infinity ? 'N/A' : `${stat.avgTime.toFixed(0)}ms`;
    console.log(`${stat.model}: ${timeStr} (${(stat.successRate * 100).toFixed(0)}% success)`);
  });

  return results;
}

// Run the tests
runTests(1).catch(console.error);