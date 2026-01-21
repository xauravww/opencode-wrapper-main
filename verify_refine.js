// verify_refine.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const API_BASE = `http://localhost:${process.env.PORT || 3010}`;
const API_KEY = process.env.API_KEY || 'your-api-key-here';

async function testRefine() {
    console.log(`Testing Refine API Flow at ${API_BASE}`);

    let imageId;

    // 1. Generate Base Image
    console.log("\n1. Generating base image...");
    try {
        const response = await fetch(`${API_BASE}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                prompt: "A beautiful mountain landscape",
                n: 1,
                size: "1024x1024"
            })
        });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();

        if (data.data && data.data[0]) {
            imageId = data.data[0].id;
            console.log("✅ Generated Image ID:", imageId);
            if (!imageId) throw new Error("No image ID returned! Cannot refine.");
        } else {
            throw new Error("No data returned");
        }
    } catch (e) {
        console.error("❌ Generation failed:", e.message);
        return;
    }

    // 2. Refine Image
    console.log("\n2. Refining image...");
    try {
        const response = await fetch(`${API_BASE}/v1/images/edits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                image: imageId,
                prompt: "Add a flowing river to the landscape"
            })
        });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();

        if (data.data && data.data[0] && data.data[0].b64_json) {
            console.log("✅ Success! Refined image received.");
            console.log("Refined Image ID:", data.data[0].id);
        } else {
            throw new Error("No refined image data returned");
        }

    } catch (e) {
        console.error("❌ Refinement failed:", e.message);
    }
}

testRefine();
