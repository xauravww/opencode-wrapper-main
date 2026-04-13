const BASE_URL = 'http://localhost:3010/v1/chat/completions';

async function testRequest(name, headers) {
    try {
        const res = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: 'hello' }]
            })
        });

        console.log(`[${name}] Status: ${res.status} ${res.statusText}`);
        if (res.status === 200) {
            console.log(`[${name}] ❌ SUCCESS (Access GRANTED - Expected DENIAL)`);
        } else {
            console.log(`[${name}] ✅ FAILED (Access DENIED)`);
        }
    } catch (e) {
        console.log(`[${name}] Error: ${e.message}`);
    }
}

console.log('--- Starting Security Check ---');
await testRequest('No Header', {});
await testRequest('Invalid Bearer', { 'Authorization': 'Bearer invalid-key-123' });
await testRequest('Garbage Header', { 'Authorization': 'Garbage' });
