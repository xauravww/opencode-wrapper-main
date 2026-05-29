import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3010';
const ADMIN_USER = 'root';
const ADMIN_PASS = 'Saur@v4168';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('--- STARTING FLOW TESTS ---');
  
  // 1. Get Admin Token
  console.log('1. Authenticating as Admin...');
  let token = null;
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
    });
    const loginData = await loginRes.json();
    if (loginData.token) {
      token = loginData.token;
      console.log('✅ Admin Token generated successfully.');
    } else {
      throw new Error('No token returned');
    }
  } catch (e) {
    console.error('❌ Failed to authenticate:', e.message);
    process.exit(1);
  }

  // Helper for requests
  const makeRequest = async (body, headers = {}) => {
    return fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // Admin bypass
        ...headers
      },
      body: JSON.stringify(body)
    });
  };

  // 2. Test Normal Request (Smart Fallback)
  console.log('\n2. Testing Standard Request (Smart Routing)...');
  try {
    const res = await makeRequest({
      messages: [{ role: 'user', content: 'Say "Hello, World!" and nothing else.' }]
    });
    if (res.ok) {
      const data = await res.json();
      console.log('✅ Success! Model used:', data.model);
      console.log('   Response:', data.choices[0].message.content);
    } else {
      console.error('❌ Failed:', await res.text());
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }

  // 3. Test Streaming Request
  console.log('\n3. Testing Streaming Request (Smart Routing)...');
  try {
    const res = await makeRequest({
      messages: [{ role: 'user', content: 'Count from 1 to 3.' }],
      stream: true
    });
    if (res.ok) {
      console.log('✅ Stream connected. Reading chunks:');
      const text = await res.text();
      console.log(`   Received ${text.split('\\n').length} chunks.`);
    } else {
      console.error('❌ Failed:', await res.text());
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  }

  // 4. Test Connected Providers Individually
  const providers = process.env.PROVIDER_PRIORITY ? process.env.PROVIDER_PRIORITY.split(',') : ['cerebras', 'groq', 'nvidia', 'gemini', 'opencode'];
  console.log('\n4. Testing Connected Providers individually via x-force-provider...');
  
  for (const provider of providers) {
    console.log(`\n--- Testing Provider: ${provider} ---`);
    try {
      const res = await makeRequest({
        messages: [{ role: 'user', content: 'What is 1+1? Answer with just the number.' }]
      }, {
        'x-force-provider': provider
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log(`✅ ${provider} SUCCESS! (Model: ${data.model})`);
        console.log(`   Response: ${data.choices[0].message.content}`);
      } else {
        const errText = await res.text();
        if (errText.includes('not configured')) {
           console.log(`⚠️ ${provider} SKIP: Not configured in .env`);
        } else {
           console.error(`❌ ${provider} FAILED:`, errText);
        }
      }
    } catch (e) {
      console.error(`❌ ${provider} ERROR:`, e.message);
    }
    
    // Slight delay to avoid hitting strict rate limits
    await sleep(2000);
  }
}

runTests();
