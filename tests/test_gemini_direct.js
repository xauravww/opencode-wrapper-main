import fetch from 'node-fetch';
import 'dotenv/config';

async function testGeminiChat() {
    console.log('🚀 Testing Gemini Chat Completion directly...');
    
    // Using port 3010 as per server config
    const url = 'http://localhost:3010/v1/chat/completions';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Server.js bypasses auth for localhost if API_KEY is missing, 
                // but let's check .env for any key
                'Authorization': 'Bearer sk-antigravity-test'
            },
            body: JSON.stringify({
                model: 'gemini-pro',
                messages: [{ role: 'user', content: 'Say hello in one word.' }],
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Response:', JSON.stringify(data.choices[0].message, null, 2));
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testGeminiChat();
