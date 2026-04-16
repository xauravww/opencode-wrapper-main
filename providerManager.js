import { ProviderKey, ProviderStats, RequestLog } from './db/mongo.js';
import { initDB } from './db/index.js';
import mongoose from 'mongoose';
import fetch from 'node-fetch';

class ProviderManager {
  constructor() {
    this.providers = {
      'opencode': {
        baseUrl: process.env.ZEN_BASE_URL || process.env.ZEN_API_URL || 'https://opencode.ai/zen/v1',
        apiKeys: this.parseApiKeys(process.env.ZEN_API_KEY),
        models: ['minimax-m2.5-free', 'grok-2', 'grok-2-vision'],
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
        models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
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
        models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
        keyIndex: 0
      },
      'nvidia': {
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        apiKeys: this.parseApiKeys(process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY),
        models: ['meta/llama-3.1-405b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct'],
        keyIndex: 0,
        healthCheckEndpoint: '/chat/completions'
      },
      'cerebras': {
        baseUrl: 'https://api.cerebras.ai/v1',
        apiKeys: this.parseApiKeys(process.env.CEREBRAS_API_KEYS || process.env.CEREBRAS_API_KEY),
        models: ['llama3.1-70b', 'llama3.1-8b'],
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
        models: ['gpt-4-turbo'],
        keyIndex: 0,
        healthCheckEndpoint: '/chat/completions'
      }
    };

    this.stats = {
      providers: {}
    };

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

    this.loadStats().then(() => {
        this.reloadKeys().catch(console.error);
    });
  }

  parseApiKeys(apiKeysStr) {
    if (!apiKeysStr || apiKeysStr === 'your-api-key-here') return [];
    return apiKeysStr.split(',').map(key => key.trim()).filter(key => key && key !== 'your-api-key-here');
  }

  getBasePriority(providerName) {
    const priorityOrder = (process.env.PROVIDER_PRIORITY || 'cerebras,groq,nvidia,gemini,openrouter,together,fireworks,anthropic,deepseek,mistral,cohere,opencode,aitools').split(',');
    const index = priorityOrder.indexOf(providerName);
    return index >= 0 ? Math.max(10, 100 - (index * 5)) : 50;
  }

  async reloadKeys() {
    try {
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
        }
      });
    } catch (error) {
       console.error('❌ Error reloading keys:', error);
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
      'cohere': process.env.COHERE_API_KEYS || process.env.COHERE_API_KEY,
      'aitools': process.env.AITOOLS_API_KEYS || process.env.AITOOLS_API_KEY,
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
        this.providers[name].apiKeys &&
        this.providers[name].apiKeys.length > 0 &&
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
        this.providers[name].apiKeys && 
        this.providers[name].apiKeys.length > 0 && 
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
    if (!apiKey) {
      throw new Error(`No API key available for ${currentProvider}`);
    }
    
    const startTime = Date.now();
    try {
      const url = p.baseUrl + endpoint;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...options.headers
      };

      const response = await fetch(url, {
        ...options,
        headers,
        timeout: 30000 // 30s timeout
      });

      const latency = Date.now() - startTime;
      const contentType = response.headers.get('content-type') || '';
      
      if (response.ok) {
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
        } else {
          console.warn(`⚠️ Provider ${currentProvider} returned OK but content-type is ${contentType}: ${text.substring(0, 100)}`);
          // If it's not JSON but OK, and user expected JSON, it's an error for us
          throw new Error(`Unexpected content-type: ${contentType}`);
        }

        await this.updateStats(currentProvider, latency, true);
        return data;
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ Provider ${currentProvider} failed (${response.status}): ${errorText.substring(0, 100)}`);
        await this.updateStats(currentProvider, latency, false);
        
        throw new Error(`Provider error: ${response.status} - ${errorText.substring(0, 50)}`);
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error(`❌ Request error for ${currentProvider}:`, error.message);
      await this.updateStats(currentProvider, latency, false);
      throw error; // Rethrow to let server.js handle retries/failover
    }
  }

  getProviderStatus() {
    const status = {};
    Object.entries(this.stats.providers).forEach(([name, p]) => {
      status[name] = {
        configured: this.providers[name].apiKeys && this.providers[name].apiKeys.length > 0,
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
      if (config.apiKeys && config.apiKeys.length > 0) {
        try {
          const endpoint = config.healthCheckEndpoint || '/models';
          const options = endpoint === '/chat/completions' 
            ? { 
                method: 'POST', 
                body: JSON.stringify({ 
                  model: config.models[0], 
                  messages: [{ role: 'user', content: 'hi' }], 
                  max_tokens: 1 
                }) 
              } 
            : { method: 'GET' };

          await this.makeRequest(name, endpoint, options);
          this.stats.providers[name].health_status = 'healthy';
        } catch (e) {
          console.warn(`Health check failed for ${name}: ${e.message}`);
          // If it's just a 404 on /models, maybe it's still "healthy" for completions?
          if (e.message.includes('404')) {
             this.stats.providers[name].health_status = 'degraded';
          } else {
             this.stats.providers[name].health_status = 'unhealthy';
          }
        }
      }
    }
  }
}

export default ProviderManager;