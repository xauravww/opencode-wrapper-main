
import dotenv from 'dotenv';
dotenv.config();

import ProviderManager from './providerManager.js';
import path from 'path';
import { fileURLToPath } from 'url';

async function testGroq() {
    console.log('🚀 Starting standalone Groq debug (ESM)...');

    const providerManager = new ProviderManager();

    // We need to initialize keys. server.js calls reloadKeys().
    // Does providerManager import db internally? We hope so.
    // If reloadKeys fails because db is missing, we will see.

    try {
        console.log('🔄 Reloading keys...');
        await providerManager.reloadKeys();
    } catch (e) {
        console.warn('⚠️ reloadKeys failed:', e.message);
        // If DB fails, maybe env vars are still loaded by initializeProviders called in constructor?
        // We'll check providers list.
        // Wait, constructor does NOT call initializeProviders in the code I saw earlier? 
        // Actually prior context said "modified initializeProviders to call reloadKeys".
        // Let's assume some keys are loaded.
    }

    console.log('Providers loaded:', Object.keys(providerManager.providers));

    if (!providerManager.providers['groq'] || providerManager.providers['groq'].apiKeys.length === 0) {
        console.error('❌ Groq provider not configured!');
        // Check environment variable manually
        console.log('ENV GROQ_API_KEY:', process.env.GROQ_API_KEY ? '(Present)' : '(Missing)');

        // Manually inject if missing for debug
        if (process.env.GROQ_API_KEY) {
            console.log('⚠️ Injecting env key manually for test...');
            providerManager.providers['groq'] = {
                baseUrl: 'https://api.groq.com/openai/v1',
                apiKeys: [process.env.GROQ_API_KEY],
                models: ['llama2-70b-4096']
            };
        } else {
            return;
        }
    }

    const groqConfig = providerManager.providers['groq'];
    console.log('🔗 Configured Base URL:', groqConfig.baseUrl);
    console.log('🔗 Full Target URL:', `${groqConfig.baseUrl}/models`);

    console.log('🎯 Attempting Groq models list...');
    try {
        const result = await providerManager.makeRequest('groq', '/models', {
            method: 'GET'
        });

        console.log('✅ Request Successful!');
        console.log('📦 Models:', JSON.stringify(result.data.map(m => m.id), null, 2));

    } catch (error) {
        console.error('❌ Request Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            // console.error('Data:', JSON.stringify(error.response.data)); 
        }
        console.error('Stack:', error.stack);
    }
}

testGroq();
