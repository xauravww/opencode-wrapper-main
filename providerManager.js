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
    this.statsFile = path.resolve(process.env.PROVIDER_STATS_FILE || path.join(__dirname, 'provider_stats.json'));
    this.speedWeightMultiplier = parseFloat(process.env.SPEED_WEIGHT_MULTIPLIER) || 0.6;
    this.errorPenaltyMultiplier = parseFloat(process.env.ERROR_PENALTY_MULTIPLIER) || 3.0;
    this.statsUpdateInterval = parseInt(process.env.STATS_UPDATE_INTERVAL) || 5000;
    this.maxStatsHistory = parseInt(process.env.MAX_STATS_HISTORY) || 1000;
    this.healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000;

    this.pendingUpdates = [];
    this.isUpdating = false;
    this.saveStatsTimeout = null;

    this.initializeProviders();
    this.loadStats();
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
        models: ['grok-code', 'code-supernova']
      }
    };

    this.providers = providerConfigs;

    // Initialize provider stats if not exists
    Object.keys(this.providers).forEach(providerName => {
      // Ensure local object structure exists
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
      this.providers[providerName] = { ...providerConfigs[providerName] }; // Deep copy
    });

    // Load dynamic keys immediately (sync-ish or fire-and-forget)
    this.reloadKeys().catch(console.error);
  }

  async reloadKeys() {
    try {
      const db = (await import('./db/index.js')).default;
      const rows = db.prepare('SELECT provider_name, api_key FROM provider_keys WHERE is_active = 1').all();

      // Reset to ENV keys first? Or just append?
      // Let's reset to ensure we don't duplicate or keep deleted keys eternally (if we only append)
      // But re-parsing ENV is annoying.
      // Let's just assume we want to ADD DB keys to the pool.

      // Group by provider
      const dbKeys = {};
      rows.forEach(row => {
        if (!dbKeys[row.provider_name]) dbKeys[row.provider_name] = [];
        dbKeys[row.provider_name].push(row.api_key);
      });

      Object.keys(this.providers).forEach(p => {
        // Start with ENV keys (re-parse from process.env if possible, but we don't store raw strings)
        // Simpler: Just ensure we merge uniq.
        // Actually, we should probably re-read ENV to support "removing" keys from ENV requires restart anyway.
        // So we take current apiKeys (which are ENV based initially) and merging DB keys.
        // Wait, if I call this multiple times, I will keep adding DB keys.
        // So I need to store "base" keys or clear them.

        // Hack: We rely on the fact that existing `apiKeys` array in memory *IS* the working set.
        // If I want to support removal, I should re-init.
        // Let's just APPEND unique keys for now (easiest for "Add key").
        // Removal via DB won't work perfectly without re-init, but "Add" is the main use case.

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
    const priorityOrder = (process.env.PROVIDER_PRIORITY || 'cerebras,groq,nvidia,gemini,openrouter,together,fireworks,anthropic,deepseek,mistral,cohere,opencode').split(',');
    const index = priorityOrder.indexOf(providerName);
    return index >= 0 ? Math.max(10, 100 - (index * 5)) : 50;
  }

  async loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = await fs.promises.readFile(this.statsFile, 'utf8');
        const loadedStats = JSON.parse(data);

        // Merge loaded stats without overwriting initialized providers
        if (loadedStats.providers) {
          for (const provider in loadedStats.providers) {
            if (!this.stats.providers[provider]) {
              this.stats.providers[provider] = loadedStats.providers[provider];
            } else {
              // Merge existing provider stats, preserving in-memory arrays if needed
              // However, typically on load we just take what's in the file
              Object.assign(this.stats.providers[provider], loadedStats.providers[provider]);
            }
          }
        }

        this.stats.last_updated = loadedStats.last_updated || this.stats.last_updated;
        this.stats.version = loadedStats.version || this.stats.version;

        console.log('✅ Provider stats loaded from file');
      } else {
        await this.saveStats(true); // Force immediate save on creation
        console.log('📝 Created new provider stats file');
      }
    } catch (error) {
      console.error('❌ Error loading provider stats:', error.message);
    }
  }

  // Modified to be non-blocking and debounced
  async saveStats(force = false) {
    if (this.saveStatsTimeout && !force) {
      return; // Already scheduled
    }

    const performSave = async () => {
      try {
        const tempFile = `${this.statsFile}.tmp`;
        // Remove temp file if exists to avoid conflicts
        try {
          await fs.promises.unlink(tempFile);
        } catch { }
        await fs.promises.writeFile(tempFile, JSON.stringify(this.stats, null, 2));
        await fs.promises.rename(tempFile, this.statsFile);
      } catch (error) {
        console.error('❌ Error saving provider stats:', error.message);
        // Fallback: try to write directly if rename fails
        try {
          await fs.promises.writeFile(this.statsFile, JSON.stringify(this.stats, null, 2));
          console.log('✅ Stats saved via fallback method');
        } catch (fallbackError) {
          console.error('❌ Fallback save also failed:', fallbackError.message);
        }
      } finally {
        this.saveStatsTimeout = null;
      }
    };

    if (force) {
      if (this.saveStatsTimeout) clearTimeout(this.saveStatsTimeout);
      return performSave();
    }

    this.saveStatsTimeout = setTimeout(performSave, 2000); // Debounce by 2 seconds
  }

  // Modified to be completely synchronous/in-memory, triggering a background save
  updateStats(providerName, requestData) {
    const providerStats = this.stats.providers[providerName];
    if (!providerStats) return;

    providerStats.total_requests++;

    if (requestData.success) {
      providerStats.successful_requests++;
      providerStats.response_times.push(requestData.responseTime);

      // Keep only recent response times
      if (providerStats.response_times.length > this.maxStatsHistory) {
        providerStats.response_times = providerStats.response_times.slice(-this.maxStatsHistory);
      }

      // Update average response time
      providerStats.avg_response_time = providerStats.response_times.reduce((a, b) => a + b, 0) / providerStats.response_times.length;

      // Update speed score (lower response time = higher score)
      const normalizedTime = Math.min(1000, providerStats.avg_response_time) / 10; // 0-100 scale
      providerStats.speed_score = Math.max(0, 100 - normalizedTime);

      // Reset sequential errors if success
      providerStats.sequential_errors = 0;

    } else {
      // Track error
      // requestData.isAuthError can be passed to immediately penalize
      if (requestData.isAuthError) {
        providerStats.error_rate = 1.0; // Mark as dead immediately
        providerStats.health_status = 'unhealthy';
      } else {
        providerStats.error_rate = (providerStats.total_requests - providerStats.successful_requests) / providerStats.total_requests;
      }
      providerStats.sequential_errors = (providerStats.sequential_errors || 0) + 1;
    }

    // Update priority based on performance
    providerStats.priority = this.calculatePriority(providerName);

    // Update health status
    providerStats.health_status = this.determineHealthStatus(providerStats);

    providerStats.last_updated = new Date().toISOString();
    this.stats.last_updated = new Date().toISOString();
    this.stats.version++;

    // Trigger save (non-blocking)
    this.saveStats();
  }

  calculatePriority(providerName) {
    const stats = this.stats.providers[providerName];
    const basePriority = this.getBasePriority(providerName);

    const speedWeight = stats.speed_score * this.speedWeightMultiplier;
    const errorPenalty = (stats.error_rate * 100) * this.errorPenaltyMultiplier;
    const healthyBonus = stats.health_status === 'healthy' ? 20 : 0; // Bonus for being confirmed healthy

    return Math.max(0, Math.min(200, basePriority + speedWeight - errorPenalty + healthyBonus));
  }

  determineHealthStatus(stats) {
    if (stats.error_rate > 0.5 || (stats.sequential_errors || 0) > 3) return 'unhealthy';
    if (stats.error_rate > 0.2) return 'degraded';
    if (stats.total_requests > 10 && stats.successful_requests / stats.total_requests < 0.8) return 'degraded';
    return 'healthy';
  }

  // New method to return ordered list of providers
  getOrderedProviders() {
    const eligibleProviders = Object.keys(this.providers).filter(providerName => {
      const config = this.providers[providerName];
      if (config.apiKeys.length === 0) return false;

      // Include 'unhealthy' only if we are desperate? No, typically we skip them.
      // But maybe we want to retry them if everything else fails?
      // For getOrderedProviders, we return all configured providers, sorted by priority.
      // The consumer will try them in order.
      return true;
    });

    return eligibleProviders.sort((a, b) => {
      // Sort by priority descending
      const priorityDiff = this.stats.providers[b].priority - this.stats.providers[a].priority;
      if (priorityDiff !== 0) return priorityDiff;

      // Tie-break with random to load balance equal priorities
      return Math.random() - 0.5;
    });
  }

  // Deprecated but kept for compatibility just in case, but using new logic
  selectProvider(requestedModel = null) {
    const list = this.getOrderedProviders();
    return list.length > 0 ? list[0] : 'opencode';
  }

  getProviderConfig(providerName) {
    const config = this.providers[providerName];
    if (!config || config.apiKeys.length === 0) return null;

    // Rotate through API keys for load balancing
    const keyIndex = Math.floor(Date.now() / 60000) % config.apiKeys.length; // Change key every minute
    const apiKey = config.apiKeys[keyIndex];

    return {
      ...config,
      apiKey,
      keyIndex
    };
  }

  getBestModelForProvider(providerName) {
    const config = this.providers[providerName];
    if (!config || config.models.length === 0) return 'gpt-3.5-turbo'; // fallback

    // Return the first model in the list (considered the best/default)
    // Could eventually match against requestedModel to find closest match
    return config.models[0];
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
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      // Add authorization header based on provider
      if (providerName === 'anthropic') {
        headers['x-api-key'] = config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (providerName === 'gemini') {
        headers['x-goog-api-key'] = config.apiKey;
      } else {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      // Add timeout signal if not present
      let signal = options.signal;
      let timeoutId = null;

      if (!signal) {
        const controller = new AbortController();
        signal = controller.signal;
        timeoutId = setTimeout(() => controller.abort(), 15000); // 15s default timeout
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401 || response.status === 402 || response.status === 403) {
          isAuthError = true;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      success = true;

      // Handle streaming response
      if (options.stream) {
        return response;
      }

      const data = await response.json();

      // DEBUG: Log usage data to file for inspection
      if (providerName === 'cerebras' || providerName === 'groq') {
        try {
          const fs = require('fs');
          fs.writeFileSync('debug_provider_response.json', JSON.stringify({ provider: providerName, data }, null, 2));
        } catch (e) { }
      }

      // Pricing Defaults (USD per 1M tokens) - Updated Jan 2025
      const PRICING = {
        'openai': { input: 2.50, output: 10.00 }, // blended gpt-4o
        'anthropic': { input: 3.00, output: 15.00 }, // sonnet 3.5
        'google': { input: 0.35, output: 1.05 }, // gemini 1.5 flash
        'mistral': { input: 2.00, output: 6.00 },
        'groq': { input: 0.59, output: 0.79 }, // llama 3 70b
        'cerebras': { input: 0.00, output: 0.00 }, // currently free tier
        'together': { input: 0.20, output: 0.20 }, // llama 3 8b
        'deepseek': { input: 0.14, output: 0.28 }, // deepseek chat
        'default': { input: 0.50, output: 1.50 }
      };

      if (data.usage) {
        usage = data.usage;
        // Calculate Cost
        const pricing = PRICING[providerName] || PRICING['default'];
        const inputCost = (usage.prompt_tokens / 1000000) * pricing.input;
        const outputCost = (usage.completion_tokens / 1000000) * pricing.output;
        finalCost = inputCost + outputCost;
      }

      return data;

    } catch (error) {
      const isTimeout = error.name === 'AbortError';
      console.error(`❌ ${providerName} request failed (Timeout: ${isTimeout}):`, error.message);

      // DEBUG: Capture full provider error
      try {
        const fs = require('fs');
        fs.writeFileSync('debug_error.json', JSON.stringify({
          provider: providerName,
          error: error.message,
          stack: error.stack,
          isTimeout
        }, null, 2));
      } catch (e) { }

      // Construct clearer error for caller
      if (isTimeout) error.message = `Request timeout after 15000ms`;
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      // Fire and forget stats update
      this.updateStats(providerName, { success, responseTime, isAuthError });

      // DB Logging
      try {
        const db = (await import('./db/index.js')).default;

        // Extract wrapperKeyId from options if available
        const wrapperKeyId = options.wrapperKeyId || null;

        db.prepare(`
             INSERT INTO request_logs (wrapper_key_id, provider, model, prompt_tokens, completion_tokens, latency_ms, status_code, cost_usd)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           `).run(
          wrapperKeyId,
          providerName,
          config.models[0], // approximate model
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

  startPeriodicUpdates() {
    setInterval(() => {
      this.saveStats(true).catch(error => {
        console.error('❌ Error in periodic stats save:', error.message);
      });
    }, this.statsUpdateInterval);
  }

  startHealthChecks() {
    // Run immediately on start
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

    // Run checks in parallel batches to avoid clogging
    const BATCH_SIZE = 3;
    for (let i = 0; i < providersToCheck.length; i += BATCH_SIZE) {
      const batch = providersToCheck.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (providerName) => {
        try {
          // Simple health check - try to get models list
          // Use a short timeout for health checks
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout for health check

          await this.makeRequest(providerName, '/models', {
            method: 'GET',
            signal: controller.signal
          });

          clearTimeout(timeout);
          console.log(`✅ ${providerName} health check passed`);
        } catch (error) {
          // console.log(`⚠️ ${providerName} health check failed: ${error.message}`);
          // Quiet failure logging to avoid spam
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

      status[providerName] = {
        configured: config.apiKeys.length > 0,
        health_status: stats.health_status,
        priority: stats.priority,
        speed_score: stats.speed_score,
        error_rate: stats.error_rate,
        total_requests: stats.total_requests,
        avg_response_time: stats.avg_response_time
      };
    });
    return status;
  }
}

export default ProviderManager;