import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function fetchModels(provider, url, headers) {
  try {
    const res = await fetch(url, { headers, timeout: 5000 });
    if (!res.ok) {
      console.log(`❌ ${provider} Failed: ${res.status} - ${await res.text()}`);
      return;
    }
    const data = await res.json();
    let models = [];
    if (data.data) {
      models = data.data.map(m => m.id);
    } else if (data.models) {
      models = data.models.map(m => m.name || m.id);
    } else if (Array.isArray(data)) {
      models = data.map(m => m.name || m.id);
    }
    console.log(`✅ ${provider} Models:`, models.filter(m => !m.includes('audio') && !m.includes('embedding') && !m.includes('whisper')).slice(0, 10).join(', '));
  } catch (e) {
    console.log(`❌ ${provider} Error: ${e.message}`);
  }
}

async function run() {
  const cKey = process.env.CEREBRAS_API_KEYS ? process.env.CEREBRAS_API_KEYS.split(',')[0] : '';
  if (cKey) {
    await fetchModels('Cerebras', 'https://api.cerebras.ai/v1/models', { 'Authorization': `Bearer ${cKey}` });
  }

  const gKey = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',')[0] : '';
  if (gKey) {
    // For gemini openai compatibility, let's check standard endpoint
    await fetchModels('Gemini', `https://generativelanguage.googleapis.com/v1beta/models?key=${gKey}`, {});
  }

  const oKey = process.env.ZEN_API_KEY;
  if (oKey) {
    await fetchModels('OpenCode', 'https://opencode.ai/zen/v1/models', { 'Authorization': `Bearer ${oKey}` });
  }
}
run();
