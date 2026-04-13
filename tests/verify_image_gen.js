// verify_image_gen.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = `http://localhost:${process.env.PORT || 3010}/v1/images/generations`;
const API_KEY = 'sk-antigravity-test'; // Using created test key

async function testImageGen() {
    console.log(`Testing Image Generation API at ${API_URL}`);
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                prompt: "A futuristic city skyline at sunset",
                n: 1,
                size: "1024x1024"
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${text}`);
        }

        const data = await response.json();
        console.log("Response:", JSON.stringify(data, null, 2));

        if (data.data && data.data[0] && data.data[0].b64_json) {
            console.log("✅ Success! Received base64 image data.");
        } else {
            console.log("⚠️ Received response but no image data found.");
        }

    } catch (error) {
        console.error("❌ Test failed:", error.message);
    }
}

testImageGen();
