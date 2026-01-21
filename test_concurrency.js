// test_concurrency.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = `http://localhost:${process.env.TEST_PORT || 3012}/v1/images/generations`;
const API_KEY = process.env.API_KEY || 'your-api-key-here';

const CONCURRENCY = 3;

async function makeRequest(id) {
    const start = Date.now();
    console.log(`[Req ${id}] Starting...`);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                prompt: `A unique robot number ${id}`,
                n: 1,
                size: "1024x1024"
            })
        });

        if (!response.ok) {
            throw new Error(`Status ${response.status}`);
        }

        const data = await response.json();
        const duration = Date.now() - start;
        console.log(`[Req ${id}] ✅ Finished in ${duration}ms`);
        return duration;
    } catch (error) {
        console.error(`[Req ${id}] ❌ Failed: ${error.message}`);
        return 0;
    }
}

async function runTest() {
    console.log(`Starting concurrency test with ${CONCURRENCY} requests...`);
    const startTotal = Date.now();

    const promises = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        promises.push(makeRequest(i + 1));
    }

    await Promise.all(promises);

    const totalDuration = Date.now() - startTotal;
    console.log(`\nAll requests completed in ${totalDuration}ms`);

    // If sequential, total ~= sum of individual. 
    // If parallel, total ~= max of individual (plus some overhead).
}

runTest();
