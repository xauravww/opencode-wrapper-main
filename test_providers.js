import fs from 'fs';
import 'dotenv/config';

const providers = {
  groq: {
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKeys: parseApiKeys(process.env.GROQ_API_KEYS),
    models: ['llama2-70b-4096', 'mixtral-8x7b-32768', 'gemma-7b-it']
  },
  nvidia: {
    baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    apiKeys: parseApiKeys(process.env.NVIDIA_API_KEYS),
    models: ['meta/llama3-70b-instruct', 'meta/llama3-8b-instruct', 'microsoft/wizardlm-2-8x22b']
  },
  gemini: {
    baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    apiKeys: parseApiKeys(process.env.GEMINI_API_KEYS),
    models: ['gemini-pro', 'gemini-pro-vision']
  },
  openrouter: {
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKeys: parseApiKeys(process.env.OPENROUTER_API_KEYS),
    models: ['anthropic/claude-3-haiku', 'openai/gpt-4o-mini', 'meta-llama/llama-3.1-405b-instruct']
  },
  together: {
    baseUrl: process.env.TOGETHER_BASE_URL || 'https://api.together.xyz/v1',
    apiKeys: parseApiKeys(process.env.TOGETHER_API_KEYS),
    models: ['meta-llama/Llama-2-70b-chat-hf', 'mistralai/Mistral-7B-Instruct-v0.1']
  },
  fireworks: {
    baseUrl: process.env.FIREWORKS_BASE_URL || 'https://api.fireworks.ai/inference/v1',
    apiKeys: parseApiKeys(process.env.FIREWORKS_API_KEYS),
    models: ['accounts/fireworks/models/llama-v3-70b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct']
  },
  cerebras: {
    baseUrl: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
    apiKeys: parseApiKeys(process.env.CEREBRAS_API_KEYS),
    models: ['llama3.1-70b', 'llama3.1-8b']
  },
  anthropic: {
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
    apiKeys: parseApiKeys(process.env.ANTHROPIC_API_KEYS),
    models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229']
  },
  deepseek: {
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    apiKeys: parseApiKeys(process.env.DEEPSEEK_API_KEYS),
    models: ['deepseek-chat', 'deepseek-coder']
  },
  mistral: {
    baseUrl: process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1',
    apiKeys: parseApiKeys(process.env.MISTRAL_API_KEYS),
    models: ['mistral-large-latest', 'mistral-medium', 'mistral-small']
  },
  cohere: {
    baseUrl: process.env.COHERE_BASE_URL || 'https://api.cohere.ai/v1',
    apiKeys: parseApiKeys(process.env.COHERE_API_KEYS),
    models: ['command', 'command-light', 'command-r']
  },
  opencode: {
    baseUrl: process.env.ZEN_BASE_URL || 'https://opencode.ai/zen/v1',
    apiKeys: [process.env.ZEN_API_KEY || 'your-zen-api-key-here'],
    models: ['grok-code', 'code-supernova']
  }
};

function parseApiKeys(apiKeysStr) {
  if (!apiKeysStr || apiKeysStr === 'your-api-key-here') return [];
  return apiKeysStr.split(',').map(key => key.trim()).filter(key => key && key !== 'your-api-key-here');
}

async function testProvider(providerName, config) {
  console.log(`\n🧪 Testing ${providerName}...`);

  if (config.apiKeys.length === 0) {
    console.log(`❌ ${providerName}: No API keys configured`);
    return;
  }

  const apiKey = config.apiKeys[0]; // Test with first key
  const url = `${config.baseUrl}/models`;

  console.log(`📡 URL: ${url}`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);

  const headers = {
    'Content-Type': 'application/json'
  };

  if (providerName === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (providerName === 'gemini') {
    headers['x-goog-api-key'] = apiKey;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${providerName}: Success - ${data.data?.length || 0} models returned`);
    } else {
      const errorText = await response.text();
      console.log(`❌ ${providerName}: Failed - ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ ${providerName}: Error - ${error.message}`);
  }
}

async function runTests() {
  console.log('🚀 Starting provider tests...\n');

  for (const [providerName, config] of Object.entries(providers)) {
    await testProvider(providerName, config);
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n✨ Testing complete!');
}

runTests().catch(console.error);