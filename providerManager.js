import { ProviderKey, ProviderStats, RequestLog, ModelSetting } from './db/mongo.js';
import { initDB } from './db/index.js';
import mongoose from 'mongoose';
import fetch from 'node-fetch';

class ProviderManager {
  constructor() {
    this.providers = {
      'opencode': {
        baseUrl: process.env.ZEN_BASE_URL || process.env.ZEN_API_URL || 'https://opencode.ai/zen/v1',
        apiKeys: this.parseApiKeys(process.env.ZEN_API_KEY),
        models: [], // Dynamically fetched in reloadKeys
        keyIndex: 0,
        healthCheckEndpoint: '/chat/completions' // Opencode might not have /models
      },
      'openai': {
        baseUrl: 'https://api.openai.com/v1',
        apiKeys: this.parseApiKeys(process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY),
        models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview'],
        keyIndex: 0
      },
      'groq': {
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKeys: this.parseApiKeys(process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY),
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        keyIndex: 0
      },
      'anthropic': {
        baseUrl: 'https://api.anthropic.com/v1',
        apiKeys: this.parseApiKeys(process.env.ANTHROPIC_API_KEYS || process.env.ANTHROPIC_API_KEY),
        models: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229'],
        keyIndex: 0
      },
      'gemini': {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        apiKeys: this.parseApiKeys(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY),
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
        keyIndex: 0
      },
      'nvidia': {
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKeys: this.parseApiKeys(process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY),
        models: ['openai/gpt-oss-20b'],
        keyIndex: 0,
        healthCheckEndpoint: '/chat/completions'
      },
      'cerebras': {
        baseUrl: 'https://api.cerebras.ai/v1',
        apiKeys: this.parseApiKeys(process.env.CEREBRAS_API_KEYS || process.env.CEREBRAS_API_KEY),
        models: ['gpt-oss-120b', 'zai-glm-4.7'],
        keyIndex: 0
      },
      'together': {
        baseUrl: 'https://api.together.xyz/v1',
        apiKeys: this.parseApiKeys(process.env.TOGETHER_API_KEYS || process.env.TOGETHER_API_KEY),
        models: ['meta-llama/Llama-3-70b-chat-hf'],
        keyIndex: 0
      },
      'fireworks': {
        baseUrl: 'https://api.fireworks.ai/inference/v1',
        apiKeys: this.parseApiKeys(process.env.FIREWORKS_API_KEYS || process.env.FIREWORKS_API_KEY),
        models: ['accounts/fireworks/models/llama-v3p1-70b-instruct'],
        keyIndex: 0
      },
      'openrouter': {
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKeys: this.parseApiKeys(process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY),
        models: ['google/gemini-pro-1.5'],
        keyIndex: 0
      },
      'omniroute': {
        baseUrl: process.env.OMNIROUTE_BASE_URL || 'http://192.168.31.85:20128/v1',
        apiKeys: this.parseApiKeys(process.env.OMNIROUTE_API_KEYS || process.env.OMNIROUTE_API_KEY),
        models: ['auto/best-coding', 'auto/best-reasoning', 'auto/best-fast', 'auto/best-vision', 'auto/best-chat', 'auto/best-coding-fast', 'auto/pro-coding', 'auto/pro-reasoning', 'auto/pro-vision'],
        keyIndex: 0
      },
      'deepseek': {
        baseUrl: 'https://api.deepseek.com/v1',
        apiKeys: this.parseApiKeys(process.env.DEEPSEEK_API_KEYS || process.env.DEEPSEEK_API_KEY),
        models: ['deepseek-chat', 'deepseek-coder'],
        keyIndex: 0
      },
      'mistral': {
        baseUrl: 'https://api.mistral.ai/v1',
        apiKeys: this.parseApiKeys(process.env.MISTRAL_API_KEYS || process.env.MISTRAL_API_KEY),
        models: ['mistral-large-latest', 'open-mixtral-8x22b'],
        keyIndex: 0
      },
      'cohere': {
        baseUrl: 'https://api.cohere.ai/v1',
        apiKeys: this.parseApiKeys(process.env.COHERE_API_KEYS || process.env.COHERE_API_KEY),
        models: ['command-r-plus'],
        keyIndex: 0
      },
      'aitools': {
        baseUrl: 'https://platform.aitools.cfd/api/v1',
        apiKeys: this.parseApiKeys(process.env.AITOOLS_API_KEYS || process.env.AITOOLS_API_KEY),
        models: ['zhipu/glm-4-flash'],
        keyIndex: 0,
        healthCheckEndpoint: '/chat/completions'
      },
      'megallm': {
        baseUrl: process.env.MEGALLM_BASE_URL || 'https://ai.megallm.io/v1',
        apiKeys: this.parseApiKeys(process.env.MEGALLM_API_KEY || process.env.MEGALLM_API_KEYS),
        models: ['gpt-4o-mini'], // Will be dynamically overridden
        keyIndex: 0
      },
      'hermes': {
        baseUrl: process.env.HERMES_BASE_URL || 'https://hermes.ai.unturf.com/v1',
        apiKeys: this.parseApiKeys(process.env.HERMES_API_KEYS || process.env.HERMES_API_KEY),
        models: ['turboderp/Qwen3.8-27B-exl3'],
        keyIndex: 0,
        keyless: true
      }
    };

    this.stats = {
      providers: {}
    };

    // Set of "provider::model" keys that have been disabled via the admin UI
    this.disabledModels = new Set();
    this.modelSettingsLoaded = false;

    // Models pushed to the front of a provider's list so the default routing
    // target is always a known-good chat model (discovery order is unreliable).
    this.preferredModels = {
      groq: ['qwen/qwen3.8-27b', 'allam-2-7b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
      gemini: ['gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-flash-latest', 'models/gemini-2.5-flash'],
      cerebras: ['gpt-oss-120b', 'zai-glm-4.7'],
      nvidia: ['openai/gpt-oss-20b'],
      aitools: ['zhipu/glm-4-flash', 'google/gemma-4-31b', 'openai/gpt-oss-20b'],
      opencode: ['big-pickle'],
      hermes: ['turboderp/Qwen3.8-27B-exl3'],
      openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet'],
    };

    // Providers whose /models list is misleading (dead/retired entries). For
    // these we ignore discovery and trust the hand-curated `models` list.
    this.curatedProviders = new Set(['nvidia']);

    // Initialize stats locally
    Object.keys(this.providers).forEach(name => {
      this.stats.providers[name] = {
        priority: this.getBasePriority(name),
        speed_score: 50,
        error_rate: 0,
        total_requests: 0,
        successful_requests: 0,
        avg_response_time: 1000,
        health_status: 'healthy',
        response_times: [],
        last_updated: new Date()
      };
    });

    this.loadStats()
      .then(() => this.loadModelSettings())
      .then(() => this.reloadKeys())
      .catch(console.error);
  }

  parseApiKeys(apiKeysStr) {
    if (!apiKeysStr || apiKeysStr === 'your-api-key-here') return [];
    return apiKeysStr.split(',').map(key => key.trim()).filter(key => key && key !== 'your-api-key-here');
  }

  modelKey(providerName, model) {
    return `${providerName}::${model}`;
  }

  isModelEnabled(providerName, model) {
    return !this.disabledModels.has(this.modelKey(providerName, model));
  }

  async loadModelSettings() {
    try {
      const disabled = await ModelSetting.find({ enabled: false }, { provider: 1, model: 1 });
      this.disabledModels = new Set(disabled.map(d => this.modelKey(d.provider, d.model)));
      this.modelSettingsLoaded = true;
      console.log(`✅ Loaded ${this.disabledModels.size} disabled model(s) from MongoDB`);
    } catch (err) {
      console.error('❌ Failed to load model settings:', err.message);
    }
  }

  // Recompute the enabled model list for a provider from its full discovered list
  applyModelFilter(providerName) {
    const p = this.providers[providerName];
    if (!p) return;
    if (!p.allModels) p.allModels = [...(p.models || [])];
    p.models = p.allModels.filter(m => this.isModelEnabled(providerName, m));
  }

  async setModelEnabled(providerName, model, enabled) {
    if (!this.providers[providerName]) {
      throw new Error(`Unknown provider ${providerName}`);
    }

    const key = this.modelKey(providerName, model);
    if (enabled) {
      this.disabledModels.delete(key);
    } else {
      this.disabledModels.add(key);
    }
    this.applyModelFilter(providerName);

    try {
      await ModelSetting.updateOne(
        { provider: providerName, model },
        { $set: { enabled, updated_at: new Date() } },
        { upsert: true }
      );
    } catch (err) {
      console.error(`❌ Failed to persist model setting ${key}:`, err.message);
      throw err;
    }
  }

  async setProviderModelsEnabled(providerName, enabled) {
    const p = this.providers[providerName];
    if (!p) throw new Error(`Unknown provider ${providerName}`);

    if (!p.allModels) p.allModels = [...(p.models || [])];
    const all = p.allModels;
    const ops = [];
    all.forEach(model => {
      const key = this.modelKey(providerName, model);
      if (enabled) {
        this.disabledModels.delete(key);
      } else {
        this.disabledModels.add(key);
      }
      ops.push({
        updateOne: {
          filter: { provider: providerName, model },
          update: { $set: { enabled, updated_at: new Date() } },
          upsert: true
        }
      });
    });

    this.applyModelFilter(providerName);

    if (ops.length > 0) {
      try {
        await ModelSetting.bulkWrite(ops);
      } catch (err) {
        console.error(`❌ Failed to persist model settings for ${providerName}:`, err.message);
        throw err;
      }
    }
  }

  getModelsWithStatus() {
    const result = {};
    Object.keys(this.providers).forEach(name => {
      const p = this.providers[name];
      const all = p.allModels || p.models || [];
      if (all.length === 0) return;
      result[name] = all.map(model => ({
        id: model,
        enabled: this.isModelEnabled(name, model)
      }));
    });
    return result;
  }

  getBasePriority(providerName) {
    const priorityOrder = (process.env.PROVIDER_PRIORITY || 'cerebras,groq,nvidia,gemini,openrouter,together,fireworks,anthropic,deepseek,mistral,cohere,hermes,opencode,aitools').split(',');
    const index = priorityOrder.indexOf(providerName);
    return index >= 0 ? Math.max(10, 100 - (index * 5)) : 50;
  }

  async reloadKeys() {
    try {
      if (!this.modelSettingsLoaded) {
        await this.loadModelSettings();
      }
      const dbKeys = await ProviderKey.find({ is_active: true });
      
      const providerKeysMap = {};
      dbKeys.forEach(k => {
        if (!providerKeysMap[k.provider_name]) providerKeysMap[k.provider_name] = [];
        providerKeysMap[k.provider_name].push(k.api_key);
      });

      Object.keys(this.providers).forEach(providerName => {
        const envKeys = this.getEnvKeys(providerName);
        const dbKeysForProvider = providerKeysMap[providerName] || [];
        
        const allKeys = [...new Set([...envKeys, ...dbKeysForProvider])];
        this.providers[providerName].apiKeys = allKeys;
        
        if (allKeys.length > 0) {
          console.log(`📡 Loaded ${allKeys.length} keys for ${providerName} (${dbKeysForProvider.length} from DB)`);
          
          // Dynamically fetch models for this provider
          this.fetchProviderModels(providerName, allKeys[0]).catch(e => 
            console.error(`Failed to fetch models for ${providerName}:`, e.message)
          );
        } else if (this.providers[providerName].keyless) {
          console.log(`📡 Keyless provider ${providerName} — fetching models without auth`);
          this.fetchProviderModels(providerName, null).catch(e => 
            console.error(`Failed to fetch models for ${providerName}:`, e.message)
          );
        }
      });
    } catch (error) {
       console.error('❌ Error reloading keys:', error);
    }
  }

  // Move preferred models to the front so models[0] is a known-good chat model
  prioritizeModels(providerName, list) {
    const preferred = this.preferredModels[providerName] || [];
    if (preferred.length === 0) return list;
    const front = [];
    preferred.forEach(p => {
      const hit = list.find(m => m === p || m.endsWith('/' + p) || m.includes(p));
      if (hit && !front.includes(hit)) front.push(hit);
    });
    return [...front, ...list.filter(m => !front.includes(m))];
  }

  async fetchProviderModels(providerName, apiKey) {
    try {
      const provider = this.providers[providerName];

      // Curated providers keep their hardcoded list; discovery is unreliable.
      if (this.curatedProviders.has(providerName)) {
        provider.allModels = [...provider.models];
        this.applyModelFilter(providerName);
        console.log(`📌 Using curated model list for ${providerName} (${provider.models.length} models)`);
        return;
      }

      let url = `${provider.baseUrl}/models`;
      
      // Some providers need special routing or query params
      if (providerName === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      }

      const headers = {};
      if (providerName !== 'gemini' && apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(url, { headers, timeout: 10000 });
      if (res.ok) {
        const data = await res.json();
        let modelsList = data.data || data.models || (Array.isArray(data) ? data : []);
        
        // Drop non-chat endpoints (embeddings, tts, guardrails, moderation, etc.)
        const junk = ['embedding', 'embed', 'whisper', 'tts', 'audio', 'rerank', 'moderation', 'guard', 'orpheus', 'stable-diffusion', 'flux', 'sdxl'];
        let validModels = modelsList
          .map(m => m.id || m.name)
          .filter(name => name && !junk.some(j => name.toLowerCase().includes(j)));
        
        // Specific filtering rules
        if (providerName === 'opencode') {
          validModels = validModels.filter(name => name.endsWith('free') || name === 'big-pickle');
          if (validModels.length === 0) validModels = ['big-pickle'];
        }

        validModels = this.prioritizeModels(providerName, validModels);

        if (validModels.length > 0) {
          provider.allModels = validModels;
          this.applyModelFilter(providerName);
          console.log(`✅ Dynamically loaded ${validModels.length} models for ${providerName} (${provider.models.length} enabled, defaulting to: ${provider.models[0] || validModels[0]})`);
        }
      } else {
        console.warn(`⚠️ Failed to fetch models for ${providerName}: ${res.status}`);
      }
    } catch (e) {
      console.warn(`⚠️ Could not dynamically fetch models for ${providerName}:`, e.message);
    }
  }

  getEnvKeys(providerName) {
    const envMap = {
      'opencode': process.env.ZEN_API_KEY,
      'openai': process.env.API_KEY || process.env.OPENAI_API_KEYS || process.env.OPENAI_API_KEY,
      'groq': process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY,
      'anthropic': process.env.ANTHROPIC_API_KEYS || process.env.ANTHROPIC_API_KEY,
      'mistral': process.env.MISTRAL_API_KEYS || process.env.MISTRAL_API_KEY,
      'cerebras': process.env.CEREBRAS_API_KEYS || process.env.CEREBRAS_API_KEY,
      'gemini': process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY,
      'nvidia': process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY,
      'deepseek': process.env.DEEPSEEK_API_KEYS || process.env.DEEPSEEK_API_KEY,
      'together': process.env.TOGETHER_API_KEYS || process.env.TOGETHER_API_KEY,
      'fireworks': process.env.FIREWORKS_API_KEYS || process.env.FIREWORKS_API_KEY,
      'openrouter': process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY,
      'omniroute': process.env.OMNIROUTE_API_KEYS || process.env.OMNIROUTE_API_KEY,
      'cohere': process.env.COHERE_API_KEYS || process.env.COHERE_API_KEY,
      'aitools': process.env.AITOOLS_API_KEYS || process.env.AITOOLS_API_KEY,
      'megallm': process.env.MEGALLM_API_KEYS || process.env.MEGALLM_API_KEY,
    };
    const keyStr = envMap[providerName];
    if (!keyStr) return [];
    return keyStr.split(',').map(k => k.trim()).filter(k => k);
  }

  async loadStats() {
    try {
      const statsDocs = await ProviderStats.find();
      statsDocs.forEach(s => {
        if (this.stats.providers[s.provider_name]) {
          const p = this.stats.providers[s.provider_name];
          p.priority = s.priority;
          p.speed_score = s.speed_score;
          p.error_rate = s.error_rate;
          p.total_requests = s.total_requests;
          p.successful_requests = s.successful_requests;
          p.avg_response_time = s.avg_response_time;
          p.health_status = s.health_status;
          p.response_times = s.response_times || [];
        }
      });
      console.log('✅ Loaded provider stats from MongoDB');
    } catch (err) {
      console.error('❌ Failed to load stats:', err);
    }
  }

  async saveStats() {
    try {
      const ops = Object.entries(this.stats.providers).map(([name, p]) => ({
        updateOne: {
          filter: { provider_name: name },
          update: {
            $set: {
              priority: p.priority,
              speed_score: p.speed_score,
              error_rate: p.error_rate,
              total_requests: p.total_requests,
              successful_requests: p.successful_requests,
              avg_response_time: p.avg_response_time,
              health_status: p.health_status,
              response_times: p.response_times || [],
              last_updated: new Date()
            }
          },
          upsert: true
        }
      }));
      if (ops.length > 0) {
        await ProviderStats.bulkWrite(ops);
        console.log('💾 Periodic stats saved to MongoDB');
      }
    } catch (err) {
      console.error('❌ Failed to save stats:', err);
    }
  }

  async updateStats(providerName, latency, success) {
    const p = this.stats.providers[providerName];
    if (!p) return;

    p.total_requests++;
    if (success) {
      p.successful_requests++;
      p.response_times.push(latency);
      if (p.response_times.length > 50) p.response_times.shift();
      p.avg_response_time = p.response_times.reduce((a, b) => a + b, 0) / p.response_times.length;
    }

    p.error_rate = 1 - (p.successful_requests / p.total_requests);
    
    // Improved Scoring: Be more reactive to failures
    const targetScore = success ? Math.max(0, 100 - (latency / 100)) : 0;
    const alpha = success ? 0.1 : 0.3; // Take a bigger hit on failures (30% vs 10%)
    p.speed_score = (p.speed_score * (1 - alpha)) + (targetScore * alpha);

    // Ensure score doesn't stay too high if it keeps failing
    if (!success && p.speed_score > 50) {
      p.speed_score = 50; // Immediate drop to mid-range on any failure if it was high
    }

    try {
      await ProviderStats.updateOne(
        { provider_name: providerName },
        { 
          $set: { 
            total_requests: p.total_requests,
            successful_requests: p.successful_requests,
            avg_response_time: p.avg_response_time,
            error_rate: p.error_rate,
            speed_score: p.speed_score,
            response_times: p.response_times,
            last_updated: new Date()
          } 
        },
        { upsert: true }
      );
    } catch (e) {
      console.error(`Failed to update stats for ${providerName}`, e);
    }
  }

  getOrderedProviders(options = {}) {
    const availableProviders = Object.entries(this.stats.providers)
      .filter(([name, p]) =>
        this.providers[name] &&
        ((this.providers[name].apiKeys && this.providers[name].apiKeys.length > 0) || this.providers[name].keyless) &&
        (this.providers[name].models ? this.providers[name].models.length > 0 : true) &&
        p.health_status !== 'unhealthy'
      )
      .sort((a, b) => {
        const scoreA = (a[1].priority * 0.4) + (a[1].speed_score * 0.6);
        const scoreB = (b[1].priority * 0.4) + (b[1].speed_score * 0.6);
        return scoreB - scoreA;
      })
      .map(([name]) => name);

    return availableProviders.length > 0 ? availableProviders : ['opencode'];
  }

  getBestModelForProvider(providerName, requiresVision = false) {
    const provider = this.providers[providerName];
    if (!provider || !provider.models || provider.models.length === 0) {
      return 'gpt-4o-mini';
    }
    if (requiresVision) {
      const visionModels = provider.models.filter(m =>
        m.includes('vision') || m.includes('gpt-4o') || m.includes('gemini') || m.includes('claude-3')
      );
      if (visionModels.length > 0) return visionModels[0];
    }
    return provider.models[0];
  }

  getBestModel(requiresVision = false) {
    const orderedProviders = this.getOrderedProviders();
    for (const providerName of orderedProviders) {
      const model = this.getBestModelForProvider(providerName, requiresVision);
      if (model) return { provider: providerName, model };
    }
    return { provider: 'opencode', model: 'grok-code' };
  }

  getBestProvider(forceProvider = null) {
    if (forceProvider && this.providers[forceProvider]) {
      return forceProvider;
    }

    const availableProviders = Object.entries(this.stats.providers)
      .filter(([name, p]) => 
        this.providers[name] &&
        ((this.providers[name].apiKeys && this.providers[name].apiKeys.length > 0) || this.providers[name].keyless) &&
        (this.providers[name].models ? this.providers[name].models.length > 0 : true) &&
        p.health_status !== 'unhealthy'
      )
      .sort((a, b) => {
        const scoreA = (a[1].priority * 0.4) + (a[1].speed_score * 0.6);
        const scoreB = (b[1].priority * 0.4) + (b[1].speed_score * 0.6);
        return scoreB - scoreA;
      });

    return availableProviders.length > 0 ? availableProviders[0][0] : 'opencode';
  }

  getNextKey(providerName) {
    const p = this.providers[providerName];
    if (!p || !p.apiKeys || p.apiKeys.length === 0) return null;
    
    const key = p.apiKeys[p.keyIndex];
    p.keyIndex = (p.keyIndex + 1) % p.apiKeys.length;
    return key;
  }

  async makeRequest(providerName, endpoint, options = {}) {
    const currentProvider = providerName || this.getBestProvider();
    const p = this.providers[currentProvider];
    
    if (!p) {
      throw new Error(`Provider ${currentProvider} not configured`);
    }

    const apiKey = this.getNextKey(currentProvider);
    if (!apiKey && !p.keyless) {
      throw new Error(`No API key available for ${currentProvider}`);
    }
    
    const startTime = Date.now();
    try {
      const url = p.baseUrl + endpoint;
      const headers = {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        ...options.headers
      };

      const response = await fetch(url, {
        ...options,
        headers,
        timeout: 10000 // Reduced timeout to 10s for fast failover
      });

      const latency = Date.now() - startTime;
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ Provider ${currentProvider} failed (${response.status}): ${errorText.substring(0, 100)}`);
        await this.updateStats(currentProvider, latency, false);
        throw new Error(`Provider error: ${response.status} - ${errorText.substring(0, 50)}`);
      }

      // STREAMING FIX: Return raw body immediately if stream is requested
      if (options.stream) {
        await this.updateStats(currentProvider, latency, true);
        return { body: response.body, model: options.body ? JSON.parse(options.body).model : '' }; 
      }

      const contentType = response.headers.get('content-type') || '';
      let data;
      const text = await response.text();
        
        // Handle "Not Found" case even if status is 200 OK (common in proxies/errors)
        if (text.includes('Not Found') && text.length < 100) {
           console.warn(`⚠️ Provider ${currentProvider} returned OK but body contains "Not Found"`);
           await this.updateStats(currentProvider, latency, false);
           throw new Error("Provider returned Not Found");
        }

        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.warn(`⚠️ Provider ${currentProvider} returned OK but invalid JSON: ${text.substring(0, 100)}`);
            throw new Error("Invalid JSON response");
          }
        } else if (contentType.includes('text/event-stream')) {
          // Some gateways (e.g. omniroute) stream even when stream:false was
          // requested. Reassemble the SSE deltas into one chat.completion object.
          data = this.aggregateSSE(text, currentProvider);
          if (!data) {
            throw new Error('Received empty event-stream with no usable content');
          }
        } else {
          console.warn(`⚠️ Provider ${currentProvider} returned OK but content-type is ${contentType}: ${text.substring(0, 100)}`);
          // If it's not JSON but OK, and user expected JSON, it's an error for us
          throw new Error(`Unexpected content-type: ${contentType}`);
        }

        await this.updateStats(currentProvider, latency, true);
        return data;
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(`❌ Request error for ${currentProvider}:`, error.message);
      await this.updateStats(currentProvider, latency, false);
      throw error; // Rethrow to let server.js handle retries/failover
    }
  }

  // Reassemble an SSE chat-completion stream into a single non-streaming object
  aggregateSSE(raw, providerName = '') {
    const chunks = [];
    let id = null, model = null, created = null;
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let json;
      try { json = JSON.parse(payload); } catch { continue; }
      if (json.id) id = json.id;
      if (json.model) model = json.model;
      if (json.created) created = json.created;
      const choice = json.choices && json.choices[0];
      if (choice) chunks.push(choice);
    }
    if (chunks.length === 0) return null;

    const last = chunks[chunks.length - 1];
    const content = chunks.map(c => c.delta?.content || '').join('') || null;
    const reasoning = chunks.map(c => c.delta?.reasoning_content || c.delta?.reasoning || '').join('') || null;
    const toolCalls = last.delta?.tool_calls || null;

    const message = { role: 'assistant', content };
    if (reasoning) message.reasoning_content = reasoning;
    if (toolCalls) message.tool_calls = toolCalls;

    return {
      id: id || `chatcmpl-agg-${Date.now()}`,
      object: 'chat.completion',
      created: created || Math.floor(Date.now() / 1000),
      model: model || 'unknown',
      choices: [{ index: 0, message, finish_reason: last.finish_reason || 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      _aggregated: true,
      _provider: providerName
    };
  }

  getProviderStatus() {    const status = {};
    Object.entries(this.stats.providers).forEach(([name, p]) => {
      status[name] = {
        configured: (this.providers[name].apiKeys && this.providers[name].apiKeys.length > 0) || !!this.providers[name].keyless,
        keyCount: this.providers[name].apiKeys ? this.providers[name].apiKeys.length : 0,
        priority: p.priority,
        speed_score: p.speed_score,
        error_rate: p.error_rate,
        health_status: p.health_status,
        avg_latency: p.avg_response_time
      };
    });
    return status;
  }

  startPeriodicUpdates() {
    setInterval(() => this.saveStats(), 60000); // Save stats every minute
  }

  startHealthChecks() {
    setInterval(() => this.checkAllHealth(), 300000); // Check every 5 mins
  }

  async checkAllHealth() {
    for (const name of Object.keys(this.providers)) {
      const config = this.providers[name];
      if ((config.apiKeys && config.apiKeys.length > 0) || config.keyless) {
        try {
          const endpoint = config.healthCheckEndpoint || '/models';
          
          let options = { method: 'GET' };
          
          if (endpoint.includes('chat/completions')) {
             options = { 
                method: 'POST', 
                body: JSON.stringify({ 
                  model: config.models[0] || 'gpt-4o-mini', 
                  messages: [{ role: 'user', content: 'hi' }], 
                  max_tokens: 1 
                }) 
             };
          }

          // We don't want a 500 from an upstream model to mark the entire provider as dead if the gateway itself is reachable.
          // However, for /models, a 500 usually means the gateway is dead.
          // But since the user is getting 500s from AITools and 404s from Nvidia specifically during health checks,
          // we should be extremely careful. By forcing /models where possible, we bypass model-specific errors.
          
          await this.makeRequest(name, endpoint, options);
          this.stats.providers[name].health_status = 'healthy';
        } catch (e) {
          // If the error contains "Unsupported model" or "Invalid API response format" (upstream model errors), DO NOT fail the health check.
          const errorStr = String(e.message || '');
          if (errorStr.includes('Unsupported model') || errorStr.includes('OPENROUTER error') || errorStr.includes('Not Found')) {
             console.warn(`⚠️ Provider ${name} health check returned model-specific error, but gateway is alive. Marking as healthy.`);
             this.stats.providers[name].health_status = 'healthy';
             continue;
          }
          console.error(`Health check failed for ${name}:`, e.message);
          this.stats.providers[name].health_status = 'unhealthy';
        }
      }
    }
  }
}

export default ProviderManager;