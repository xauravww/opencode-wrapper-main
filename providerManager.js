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
    this.statsFile = process.env.PROVIDER_STATS_FILE || path.join(__dirname, 'provider_stats.json');
    this.speedWeightMultiplier = parseFloat(process.env.SPEED_WEIGHT_MULTIPLIER) || 0.6;
    this.errorPenaltyMultiplier = parseFloat(process.env.ERROR_PENALTY_MULTIPLIER) || 3.0;
    this.statsUpdateInterval = parseInt(process.env.STATS_UPDATE_INTERVAL) || 5000;
    this.maxStatsHistory = parseInt(process.env.MAX_STATS_HISTORY) || 1000;
    this.healthCheckInterval = parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000;

    this.pendingUpdates = [];
    this.isUpdating = false;

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
         models: ['llama2-70b-4096', 'mixtral-8x7b-32768', 'gemma-7b-it', 'gpt-3.5-turbo', 'gpt-4']
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
         models: ['llama3.1-70b', 'llama3.1-8b', 'gpt-3.5-turbo', 'gpt-4']
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

    // Initialize provider stats if not exists
    Object.keys(providerConfigs).forEach(providerName => {
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
      this.providers[providerName] = providerConfigs[providerName];
    });
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
              // Merge existing provider stats
              Object.assign(this.stats.providers[provider], loadedStats.providers[provider]);
            }
          }
        }

        this.stats.last_updated = loadedStats.last_updated || this.stats.last_updated;
        this.stats.version = loadedStats.version || this.stats.version;

        console.log('✅ Provider stats loaded from file');
      } else {
        await this.saveStats();
        console.log('📝 Created new provider stats file');
      }
    } catch (error) {
      console.error('❌ Error loading provider stats:', error.message);
    }
  }

  async saveStats() {
    try {
      const tempFile = `${this.statsFile}.tmp`;
      // Remove temp file if exists to avoid conflicts
      try {
        await fs.promises.unlink(tempFile);
      } catch {}
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
    }
  }

  async updateStats(providerName, requestData) {
    this.pendingUpdates.push({ providerName, requestData });

    if (this.isUpdating) return;

    this.isUpdating = true;

    try {
      while (this.pendingUpdates.length > 0) {
        const updates = [...this.pendingUpdates];
        this.pendingUpdates = [];

        for (const update of updates) {
          await this.processStatsUpdate(update.providerName, update.requestData);
        }

        await this.saveStats();
      }
    } catch (error) {
      console.error('❌ Error updating provider stats:', error.message);
    } finally {
      this.isUpdating = false;
    }
  }

  async processStatsUpdate(providerName, requestData) {
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

    } else {
      // Track error
      providerStats.error_rate = (providerStats.total_requests - providerStats.successful_requests) / providerStats.total_requests;
    }

    // Update priority based on performance
    providerStats.priority = this.calculatePriority(providerName);

    // Update health status
    providerStats.health_status = this.determineHealthStatus(providerStats);

    providerStats.last_updated = new Date().toISOString();
    this.stats.last_updated = new Date().toISOString();
    this.stats.version++;
  }

  calculatePriority(providerName) {
    const stats = this.stats.providers[providerName];
    const basePriority = this.getBasePriority(providerName);

    const speedWeight = stats.speed_score * this.speedWeightMultiplier;
    const errorPenalty = (stats.error_rate * 100) * this.errorPenaltyMultiplier;

    return Math.max(0, Math.min(100, basePriority + speedWeight - errorPenalty));
  }

  determineHealthStatus(stats) {
    if (stats.error_rate > 0.5) return 'unhealthy';
    if (stats.error_rate > 0.2) return 'degraded';
    if (stats.total_requests > 10 && stats.successful_requests / stats.total_requests < 0.8) return 'degraded';
    return 'healthy';
  }

  selectProvider(requestedModel = null) {
    const eligibleProviders = Object.keys(this.providers).filter(providerName => {
      const config = this.providers[providerName];
      const stats = this.stats.providers[providerName];

      // Must have API keys and be healthy
      return config.apiKeys.length > 0 &&
             stats.health_status !== 'unhealthy' &&
             (stats.health_status !== 'degraded' || Math.random() > 0.7);
    });

    if (eligibleProviders.length === 0) {
      // Fallback to opencode if no providers available
      return 'opencode';
    }

    // Sort by calculated priority (highest first)
    eligibleProviders.sort((a, b) => {
      return this.stats.providers[b].priority - this.stats.providers[a].priority;
    });

    // Return top 5 providers and pick one randomly for load balancing
    const topProviders = eligibleProviders.slice(0, Math.min(5, eligibleProviders.length));
    return topProviders[Math.floor(Math.random() * topProviders.length)];
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
    return config.models[0];
  }

  async makeRequest(providerName, endpoint, options = {}) {
    const config = this.getProviderConfig(providerName);
    if (!config) {
      throw new Error(`No valid configuration for provider: ${providerName}`);
    }

    const startTime = Date.now();
    let success = false;

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

      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      success = true;
      return await response.json();

    } catch (error) {
      console.error(`❌ ${providerName} request failed:`, error.message);
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      await this.updateStats(providerName, { success, responseTime });
    }
  }

  startPeriodicUpdates() {
    setInterval(() => {
      this.saveStats().catch(error => {
        console.error('❌ Error in periodic stats save:', error.message);
      });
    }, this.statsUpdateInterval);
  }

  startHealthChecks() {
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

    for (const providerName of providersToCheck) {
      try {
        // Simple health check - try to get models list
        await this.makeRequest(providerName, '/models', { method: 'GET' });
        console.log(`✅ ${providerName} health check passed`);
      } catch (error) {
        console.log(`⚠️ ${providerName} health check failed: ${error.message}`);
        // Health check failure is already tracked in updateStats
      }
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