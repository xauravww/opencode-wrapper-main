import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3010';
const ADMIN_USER = 'root';
const ADMIN_PASS = 'Saur@v4168';

async function run() {
  console.log('1. Authenticating as Admin...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
  });
  const { token } = await loginRes.json();
  if (!token) throw new Error("No token");

  console.log('✅ Admin Token generated successfully.');
  console.log('\n--- Sending 5 consecutive standard requests ---');
  console.log('Watch how the load balancer picks the provider based on speed and health.\n');
  
  for (let i = 1; i <= 5; i++) {
    const start = Date.now();
    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Say hello and state your provider name.' }] })
    });
    
    if (res.ok) {
      const data = await res.json();
      const content = data.choices[0].message.content.replace(/\n/g, ' ').substring(0, 50);
      console.log(`[Req ${i}] Selected Model: ${data.model.padEnd(20)} | Latency: ${Date.now() - start}ms | Resp: ${content}...`);
    } else {
      console.log(`[Req ${i}] Failed: ${res.status}`);
    }
  }
}
run();
