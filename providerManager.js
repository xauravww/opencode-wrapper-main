import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProviderManager {
  constructor() {
    this.providers = {};
    this.stats = {
      providers: {},
      last_updated: new Date().toISOString(),
      version: 1
    };

    // Config
    this.speedWeightMultiplier = parseFloat(process.env.SPEED_WEIGHT_MULTIPLIER) || 0.6;
    this.errorPenaltyMultiplier = parseFloat(process.env.ERROR_PENALTY_MULTIPLIER) || 3.0;
    this.statsUpdateInterval = parseInt(process.env.STATS_UPDATE_INTERVAL) || 5000;
    this.maxStatsHistory = parseInt(process.env.MAX_STATS_HISTORY) || 1000;
    this.healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000;

    this.initializeProviders();
    this.loadStats().catch(console.error);
    this.startPeriodicUpdates();
    this.startHealthChecks();
  }

  initializeProviders() {
    const providerConfigs = {
      groq: {
        baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
        apiKeys: this.parseApiKeys(process.env.GROQ_API_KEYS),
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it']
      },
      nvidia: {
        baseUrl: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
        apiKeys: this.parseApiKeys(process.env.NVIDIA_API_KEYS),
        models: ['meta/llama3-70b-instruct', 'meta/llama3-8b-instruct', 'microsoft/wizardlm-2-8x22b', 'gpt-3.5-turbo', 'gpt-4']
      },
      gemini: {
        baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
        apiKeys: this.parseApiKeys(process.env.GEMINI_API_KEYS),
        models: ['gemini-pro', 'gemini-pro-vision']
      },
      openrouter: {
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        apiKeys: this.parseApiKeys(process.env.OPENROUTER_API_KEYS),
        models: ['anthropic/claude-3-haiku', 'openai/gpt-4o-mini', 'meta-llama/llama-3.1-405b-instruct', 'gpt-3.5-turbo', 'gpt-4', 'gpt-4o']
      },
      together: {
        baseUrl: process.env.TOGETHER_BASE_URL || 'https://api.together.xyz/v1',
        apiKeys: this.parseApiKeys(process.env.TOGETHER_API_KEYS),
        models: ['meta-llama/Llama-2-70b-chat-hf', 'mistralai/Mistral-7B-Instruct-v0.1']
      },
      fireworks: {
        baseUrl: process.env.FIREWORKS_BASE_URL || 'https://api.fireworks.ai/inference/v1',
        apiKeys: this.parseApiKeys(process.env.FIREWORKS_API_KEYS),
        models: ['accounts/fireworks/models/llama-v3-70b-instruct', 'accounts/fireworks/models/mixtral-8x7b-instruct']
      },
      cerebras: {
        baseUrl: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
        apiKeys: this.parseApiKeys(process.env.CEREBRAS_API_KEYS),
        models: ['llama-3.3-70b', 'llama3.1-8b', 'gpt-3.5-turbo', 'gpt-4']
      },
      anthropic: {
        baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
        apiKeys: this.parseApiKeys(process.env.ANTHROPIC_API_KEYS),
        models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229']
      },
      deepseek: {
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
        apiKeys: this.parseApiKeys(process.env.DEEPSEEK_API_KEYS),
        models: ['deepseek-chat', 'deepseek-coder']
      },
      mistral: {
        baseUrl: process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1',
        apiKeys: this.parseApiKeys(process.env.MISTRAL_API_KEYS),
        models: ['mistral-large-latest', 'mistral-medium', 'mistral-small']
      },
      cohere: {
        baseUrl: process.env.COHERE_BASE_URL || 'https://api.cohere.ai/v1',
        apiKeys: this.parseApiKeys(process.env.COHERE_API_KEYS),
        models: ['command', 'command-light', 'command-r']
      },
      opencode: {
        baseUrl: process.env.ZEN_BASE_URL || 'https://opencode.ai/zen/v1',
        apiKeys: [process.env.ZEN_API_KEY || 'your-zen-api-key-here'],
        models: ['minimax-m2.1-free', 'grok-code']
      },
      aitools: {
        baseUrl: process.env.AITOOLS_BASE_URL || 'https://platform.aitools.cfd/api/v1',
        apiKeys: this.parseApiKeys(process.env.AITOOLS_API_KEYS),
        models: [
          'qwen/qwen2.5-72b', 'qwen/qwen2.5-7b', 'qwen/qwen2.5-14b',
          'qwen/qwen3-8b', 'qwen/qwen3-30b-a3b', 'qwen/qwen3-coder',
          'deepseek/deepseek-r1-70b', 'deepseek/deepseek-r1-32b', 'deepseek/deepseek-v3-0324',
          'google/gemini-2.0-flash-exp', 'google/gemma-3-27b',
          'zhipu/glm-4-flash', 'zhipu/glm-4-9b', 'zhipu/glm-4v-flash',
          'zhipu/glm-4.1v-thinking-flash', 'zhipu/glm-4.6v-flash', 'zhipu/glm-4.7-flash'
        ]
      }
    };

    this.providers = providerConfigs;

    // Initialize in-memory structure
    Object.keys(this.providers).forEach(providerName => {
      if (!this.stats.providers[providerName]) {
        this.stats.providers[providerName] = {
          priority: this.getBasePriority(providerName),
          speed_score: 50,
          error_rate: 0,
          total_requests: 0,
          successful_requests: 0,
          avg_response_time: 1000,
          last_updated: new Date().toISOString(),
          health_status: 'healthy',
          response_times: []
        };
      }
      this.providers[providerName] = { ...providerConfigs[providerName] };
    });

    this.reloadKeys().catch(console.error);
  }

  async reloadKeys() {
    try {
      const db = (await import('./db/index.js')).default;
      const rows = db.prepare('SELECT provider_name, api_key FROM provider_keys WHERE is_active = 1').all();

      const dbKeys = {};
      rows.forEach(row => {
        if (!dbKeys[row.provider_name]) dbKeys[row.provider_name] = [];
        dbKeys[row.provider_name].push(row.api_key);
      });

      Object.keys(this.providers).forEach(p => {
        if (dbKeys[p]) {
          const currentKeys = new Set(this.providers[p].apiKeys);
          dbKeys[p].forEach(k => currentKeys.add(k));
          this.providers[p].apiKeys = Array.from(currentKeys);
        }
      });

      console.log('🔄 Provider keys reloaded from DB');
    } catch (err) {
      console.error('Failed to load dynamic keys:', err.message);
    }
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

  async loadStats() {
    try {
      const db = (await import('./db/index.js')).default;
      const rows = db.prepare('SELECT * FROM provider_stats').all();

      rows.forEach(row => {
        const providerName = row.provider_name;
        if (this.stats.providers[providerName]) {
          const pStats = this.stats.providers[providerName];
          pStats.priority = row.priority;
          pStats.speed_score = row.speed_score;
          pStats.error_rate = row.error_rate;
          pStats.total_requests = row.total_requests;
          pStats.successful_requests = row.successful_requests;
          pStats.avg_response_time = row.avg_response_time;
          pStats.health_status = row.health_status;
          pStats.last_updated = row.last_updated;

          try {
            pStats.response_times = row.response_times_json ? JSON.parse(row.response_times_json) : [];
          } catch (e) {
            pStats.response_times = [];
          }
        }
      });
      console.log('✅ Provider stats loaded from DB');
    } catch (error) {
      console.error('❌ Error loading provider stats from DB:', error.message);
    }
  }

  async saveStats(force = false) {
    if (this.saveStatsTimeout && !force) return;

    const performSave = async () => {
      try {
        const db = (await import('./db/index.js')).default;
        const updateStmt = db.prepare(`
          INSERT INTO provider_stats (
            provider_name, priority, speed_score, error_rate, total_requests, successful_requests,
            avg_response_time, health_status, last_updated, response_times_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(provider_name) DO UPDATE SET
            priority=excluded.priority,
            speed_score=excluded.speed_score,
            error_rate=excluded.error_rate,
            total_requests=excluded.total_requests,
            successful_requests=excluded.successful_requests,
            avg_response_time=excluded.avg_response_time,
            health_status=excluded.health_status,
            last_updated=excluded.last_updated,
            response_times_json=excluded.response_times_json
        `);

        const transaction = db.transaction((providers) => {
          for (const [name, stats] of Object.entries(providers)) {
            if (!this.providers[name]) continue;
            updateStmt.run(
              name,
              stats.priority,
              stats.speed_score,
              stats.error_rate,
              stats.total_requests,
              stats.successful_requests,
              stats.avg_response_time,
              stats.health_status,
              stats.last_updated,
              JSON.stringify(stats.response_times)
            );
          }
        });

        transaction(this.stats.providers);
      } catch (error) {
        console.error('❌ Error saving provider stats to DB:', error.message);
      } finally {
        this.saveStatsTimeout = null;
      }
    };

    if (force) {
      if (this.saveStatsTimeout) clearTimeout(this.saveStatsTimeout);
      return performSave();
    }

    this.saveStatsTimeout = setTimeout(performSave, 2000);
  }

  updateStats(providerName, requestData) {
    const providerStats = this.stats.providers[providerName];
    if (!providerStats) return;

    providerStats.total_requests++;

    if (requestData.success) {
      providerStats.successful_requests++;
      providerStats.response_times.push(requestData.responseTime);

      if (providerStats.response_times.length > this.maxStatsHistory) {
        providerStats.response_times = providerStats.response_times.slice(-this.maxStatsHistory);
      }

      providerStats.avg_response_time = providerStats.response_times.reduce((a, b) => a + b, 0) / providerStats.response_times.length;
      const normalizedTime = Math.min(1000, providerStats.avg_response_time) / 10;
      providerStats.speed_score = Math.max(0, 100 - normalizedTime);
      providerStats.sequential_errors = 0;

    } else {
      if (requestData.isAuthError) {
        providerStats.error_rate = 1.0;
        providerStats.health_status = 'unhealthy';
      } else {
        providerStats.error_rate = (providerStats.total_requests - providerStats.successful_requests) / providerStats.total_requests;
      }
      providerStats.sequential_errors = (providerStats.sequential_errors || 0) + 1;
    }

    providerStats.priority = this.calculatePriority(providerName);
    providerStats.health_status = this.determineHealthStatus(providerStats);
    providerStats.last_updated = new Date().toISOString();
    this.stats.last_updated = new Date().toISOString();
    this.stats.version++;

    this.saveStats();
  }

  calculatePriority(providerName) {
    const stats = this.stats.providers[providerName];
    const basePriority = this.getBasePriority(providerName);

    const speedWeight = stats.speed_score * this.speedWeightMultiplier;
    const errorPenalty = (stats.error_rate * 100) * this.errorPenaltyMultiplier;
    const healthyBonus = stats.health_status === 'healthy' ? 20 : 0;

    return Math.max(0, Math.min(200, basePriority + speedWeight - errorPenalty + healthyBonus));
  }

  determineHealthStatus(stats) {
    if (stats.error_rate > 0.5 || (stats.sequential_errors || 0) > 3) return 'unhealthy';
    if (stats.error_rate > 0.2) return 'degraded';
    if (stats.total_requests > 10 && stats.successful_requests / stats.total_requests < 0.8) return 'degraded';
    return 'healthy';
  }

  getOrderedProviders(options = {}) {
    const { requiresVision = false } = options;

    let providers = Object.keys(this.providers).filter(providerName => {
      const config = this.providers[providerName];
      return config.apiKeys.length > 0 && this.stats.providers[providerName].health_status !== 'unhealthy';
    });

    if (requiresVision) {
      const visionPriority = ['nvidia', 'openai', 'anthropic', 'google', 'groq', 'together', 'openrouter'];
      providers.sort((a, b) => {
        const indexA = visionPriority.indexOf(a);
        const indexB = visionPriority.indexOf(b);

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;

        const priorityDiff = this.stats.providers[b].priority - this.stats.providers[a].priority;
        return priorityDiff !== 0 ? priorityDiff : Math.random() - 0.5;
      });
    } else {
      providers.sort((a, b) => {
        const priorityDiff = this.stats.providers[b].priority - this.stats.providers[a].priority;
        if (priorityDiff !== 0) return priorityDiff;
        return Math.random() - 0.5;
      });
    }

    return providers;
  }

  selectProvider(requestedModel = null) {
    const list = this.getOrderedProviders();
    return list.length > 0 ? list[0] : 'opencode';
  }

  getProviderConfig(providerName) {
    const config = this.providers[providerName];
    if (!config || config.apiKeys.length === 0) return null;

    const keyIndex = Math.floor(Date.now() / 60000) % config.apiKeys.length;
    const apiKey = config.apiKeys[keyIndex];

    return { ...config, apiKey, keyIndex };
  }

  getBestModelForProvider(providerName, requiresVision = false) {
    if (requiresVision) return this.getBestVisionModelForProvider(providerName);
    const config = this.providers[providerName];
    if (!config || config.models.length === 0) return 'gpt-3.5-turbo';
    return config.models[0];
  }

  getBestVisionModelForProvider(providerName) {
    const visionModels = {
      'nvidia': 'nvidia/llama-3.2-11b-vision-instruct',
      'groq': 'llama-3.2-11b-vision-preview',
      'openai': 'gpt-4o',
      'anthropic': 'claude-3-5-sonnet-20240620',
      'google': 'gemini-1.5-flash',
      'openrouter': 'google/gemini-flash-1.5',
      'mistral': 'pixtral-12b-2409',
      'together': 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
      'fireworks': 'accounts/fireworks/models/llama-v3p2-11b-vision-instruct'
    };

    if (visionModels[providerName]) return visionModels[providerName];

    const config = this.providers[providerName];
    if (config) {
      const found = config.models.find(m => m.toLowerCase().includes('vision') || m.toLowerCase().includes('gpt-4o') || m.toLowerCase().includes('pixtral'));
      if (found) return found;
    }

    return this.getBestModelForProvider(providerName);
  }

  async makeRequest(providerName, endpoint, options = {}) {
    const config = this.getProviderConfig(providerName);
    if (!config) {
      throw new Error(`No valid configuration for provider: ${providerName}`);
    }

    const startTime = Date.now();
    let success = false;
    let isAuthError = false;

    let usage = { prompt_tokens: 0, completion_tokens: 0 };
    let finalCost = 0;

    try {
      const url = `${config.baseUrl}${endpoint}`;
      const headers = { 'Content-Type': 'application/json', ...options.headers };

      if (providerName === 'anthropic') {
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (providerName === 'gemini') {
        headers['x-goog-api-key'] = config.apiKey;
      } else {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      let signal = options.signal;
      let timeoutId = null;

      if (!signal) {
        const controller = new AbortController();
        signal = controller.signal;
        timeoutId = setTimeout(() => controller.abort(), 15000);
      }

      const response = await fetch(url, { ...options, headers, signal });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 || response.status === 402 || response.status === 403) {
          isAuthError = true;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      success = true;

      if (options.stream) {
        return response;
      }

      const data = await response.json();

      if (data.usage) {
        usage = data.usage;
        if (!this.pricingCache) this.pricingCache = new Map();
        const cacheKey = `${providerName}:${data.model}`;
        let pricing = this.pricingCache.get(cacheKey);

        if (!pricing) {
          try {
            const db = (await import('./db/index.js')).default;
            const row = db.prepare(`
              SELECT input_cost_per_1m, output_cost_per_1m 
              FROM model_pricing 
              WHERE (provider = ? AND model = ?) 
                 OR (provider = ? AND model = '*') 
                 OR (provider = 'default' AND model = '*')
              ORDER BY (provider = ? AND model = ?) DESC, (provider = ? AND model = '*') DESC
              LIMIT 1
            `).get(providerName, data.model, providerName, providerName, data.model, providerName);

            if (row) {
              pricing = { input: row.input_cost_per_1m, output: row.output_cost_per_1m };
              this.pricingCache.set(cacheKey, pricing);
            } else {
              pricing = { input: 0.50, output: 1.50 };
            }
          } catch (e) {
            pricing = { input: 0.50, output: 1.50 };
          }
        }

        const inputCost = (usage.prompt_tokens / 1000000) * pricing.input;
        const outputCost = (usage.completion_tokens / 1000000) * pricing.output;
        finalCost = inputCost + outputCost;
      }

      return data;

    } catch (error) {
      const isTimeout = error.name === 'AbortError';
      if (isTimeout) error.message = `Request timeout after 15000ms`;
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      this.updateStats(providerName, { success, responseTime, isAuthError });

      if (!options.skipLog) {
        try {
          const db = (await import('./db/index.js')).default;
          const wrapperKeyId = options.wrapperKeyId || null;

          db.prepare(`
               INSERT INTO request_logs (wrapper_key_id, provider, model, prompt_tokens, completion_tokens, latency_ms, status_code, cost_usd)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             `).run(
            wrapperKeyId,
            providerName,
            config.models[0],
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            responseTime,
            success ? 200 : 500,
            finalCost
          );
        } catch (err) {
          console.error('DB Log Error:', err.message);
        }
      }
    }
  }

  startPeriodicUpdates() {
    setInterval(() => {
      this.saveStats(true).catch(error => {
        console.error('❌ Error in periodic stats save (DB):', error.message);
      });
    }, this.statsUpdateInterval);
  }

  startHealthChecks() {
    this.performHealthChecks().catch(console.error);
    setInterval(() => {
      this.performHealthChecks().catch(error => {
        console.error('❌ Error in health checks:', error.message);
      });
    }, this.healthCheckInterval);
  }

  async performHealthChecks() {
    const providersToCheck = Object.keys(this.providers).filter(providerName => {
      return this.providers[providerName].apiKeys.length > 0;
    });

    const BATCH_SIZE = 3;
    for (let i = 0; i < providersToCheck.length; i += BATCH_SIZE) {
      const batch = providersToCheck.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (providerName) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          await this.makeRequest(providerName, '/models', {
            method: 'GET',
            signal: controller.signal,
            skipLog: true
          });

          clearTimeout(timeout);
          console.log(`✅ ${providerName} health check passed`);
        } catch (error) {
        }
      }));
    }
  }

  getStats() {
    return { ...this.stats };
  }

  getProviderStatus() {
    const status = {};
    Object.keys(this.providers).forEach(providerName => {
      const config = this.providers[providerName];
      const stats = this.stats.providers[providerName];
      const isConfigured = config.apiKeys && config.apiKeys.length > 0 && 
        config.apiKeys.some(key => key && key.trim() !== '' && key !== 'your-api-key-here' && key !== 'your-zen-api-key-here');

      if (!isConfigured) return;

      status[providerName] = {
        configured: isConfigured,
        health_status: stats?.health_status || 'unknown',
        priority: stats?.priority || 0,
        speed_score: stats?.speed_score || 0,
        error_rate: stats?.error_rate || 0,
        total_requests: stats?.total_requests || 0,
        avg_response_time: stats?.avg_response_time || 0
      };
    });
    return status;
  }
}

export default ProviderManager;