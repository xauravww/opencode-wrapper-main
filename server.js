import fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { Readable } from 'stream';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import ProviderManager from './providerManager.js';
import cron from 'node-cron';
import { initDB } from './db/index.js';
import db from './db/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { trackStreamAndLog } from './utils/streamTracker.js';
import { sendBackupEmail } from './utils/emailService.js';
import { Communicate } from 'edge-tts-universal';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o)
  : ['*'];

app.use(cors({
  origin: (origin, callback) => {
    // 1. Allow requests with no origin (like curl, mobile apps, or same-origin)
    if (!origin || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // 2. Exact match check
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // 3. Fallback: Check if origin (without trailing slash) matches
    const normalizedOrigin = origin.replace(/\/$/, "");
    if (allowedOrigins.some(o => o.replace(/\/$/, "") === normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn(`🔒 CORS Blocked: Origin "${origin}" is not in ALLOWED_ORIGINS. Update your .env to include this exact string.`);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token', 'x-force-provider'],
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));

// MCP Servers Configuration
const mcpServers = {
  searxng: {
    command: "npx",
    args: ["-y", "mcp-searxng"],
    env: { SEARXNG_URL: "http://localhost:10000" },
    alwaysAllow: ["searxng_web_search"],
    timeout: 300
  },
  sequentialthinking: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    alwaysAllow: ["sequentialthinking"]
  },
  puppeteer: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    env: { PUPPETEER_CACHE_DIR: "/home/saurav/.cache/puppeteer" },
    alwaysAllow: ["puppeteer_fill", "puppeteer_evaluate"]
  }
};

// Logging middleware
app.use(morgan('combined')); // Logs: method, url, status, response time, etc.

// MCP Tool Execution Function
async function executeMCPTool(serverName, toolName, args) {
  const serverConfig = mcpServers[serverName];
  if (!serverConfig) {
    throw new Error(`MCP server ${serverName} not configured`);
  }

  if (!serverConfig.alwaysAllow.includes(toolName)) {
    throw new Error(`Tool ${toolName} not allowed for server ${serverName}`);
  }

  const transport = new StdioServerTransport({
    command: serverConfig.command,
    args: serverConfig.args,
    env: { ...process.env, ...serverConfig.env }
  });

  const client = new Client({ name: 'opencode-wrapper', version: '1.0.0' });

  try {
    await client.connect(transport);
    const result = await client.callTool({ name: toolName, arguments: args });
    return result;
  } finally {
    await client.close();
  }
}

app.use(express.json({ limit: '50mb' }));

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to API routes (skip in development)
const skipRateLimit = process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true';
if (!skipRateLimit) {
  app.use('/v1/', limiter);
}

// Simple API key authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === 'your-api-key-here') {
    // Skip auth if not configured
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  if (token !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OpenAI-like Wrapper for Opencode',
      version: '1.0.0',
      description: 'A wrapper that mimics OpenAI API using Opencode SDK',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3010}`,
      },
    ],
  },
  apis: ['./server.js'],
};

const specs = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT (for Admin API)
const verifyToken = (req, res, next) => {
  const token = req.headers['x-access-token'] || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(403).json({ error: 'A token is required for authentication' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Token' });
  }
  return next();
};

// Middleware to verify Wrapper API Keys
const verifyWrapperKey = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // 1. Allow Admin JWT (for Playground/Testing)
  const token = req.headers['x-access-token'] || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      // Valid Admin Token -> Allow access with a "system" key ID for logging
      req.wrapperKeyId = null; // or 0? 0 might mean system.
      return next();
    } catch (e) {
      // Not a valid JWT, continue to check as API Key
    }
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Log missing header failure
    try {
      db.prepare('INSERT INTO request_logs (provider, model, status_code, cost_usd) VALUES (?, ?, ?, ?)').run('system', 'auth-missing', 401, 0);
    } catch (e) { console.error('Failed to log auth error:', e); }

    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const apiKey = authHeader.split(' ')[1];

  // Check DB for custom keys
  try {
    // crypto is imported at top level
    const hash = createHash('sha256').update(apiKey).digest('hex');

    const keyRecord = db.prepare('SELECT id, is_active FROM wrapper_keys WHERE api_key_hash = ?').get(hash);

    if (keyRecord && keyRecord.is_active) {
      req.wrapperKeyId = keyRecord.id;
      return next();
    }
  } catch (err) {
    console.error("Key verification error:", err.message);
  }

  // Log invalid key failure
  try {
    db.prepare('INSERT INTO request_logs (provider, model, status_code, cost_usd) VALUES (?, ?, ?, ?)').run('system', 'auth-invalid', 401, 0);
  } catch (e) { console.error('Failed to log auth error:', e); }

  return res.status(401).json({ error: 'Invalid API Key' });
};

async function start() {
  // Initialize Database First
  initDB();

  // Initialize Provider Manager
  const providerManager = new ProviderManager();
  await providerManager.reloadKeys(); // Load dynamic keys from DB

  // Log Cleanup Task (Daily at midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('🧹 Running daily log cleanup...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString();

      // Check for old logs first
      const oldLogs = db.prepare('SELECT * FROM request_logs WHERE timestamp < ?').all(cutoffDate);

      if (oldLogs.length > 0) {
        console.log(`Found ${oldLogs.length} old logs to delete. Sending backup first...`);
        try {
          if (process.env.OWNER_MAIL) {
            await sendBackupEmail(process.env.OWNER_MAIL, oldLogs);
            console.log('✅ Backup email sent successfully. Proceeding with deletion.');
          } else {
            console.warn('⚠️ OWNER_MAIL not set. Skipping email backup, but proceeding with deletion (or safe to keep? Deciding to keep for safety if backup fails).');
            // SAFETY: If you want to force backup, throw here. 
            // But if user didn't config email, maybe we should just delete? 
            // User requested backup "before deleting". So if no email, maybe don't delete?
            // Let's assume we proceed if no email config, but if email fails we abort using try/catch.
            console.log('⚠️ No owner email configured, logs will be deleted without backup.');
          }

          const result = db.prepare('DELETE FROM request_logs WHERE timestamp < ?').run(cutoffDate);
          console.log(`✅ Deleted ${result.changes} old request logs`);

        } catch (emailError) {
          console.error('❌ Backup email failed! Aborting deletion to save data.', emailError);
        }
      } else {
        console.log('No old logs to clean up.');
      }
    } catch (error) {
      console.error('❌ Log cleanup failed:', error);
    }
  });

  // Run cleanup once on startup
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const result = db.prepare('DELETE FROM request_logs WHERE timestamp < ?').run(thirtyDaysAgo.toISOString());
    if (result.changes > 0) console.log(`🧹 Cleanup on startup: Deleted ${result.changes} old logs`);
  } catch (e) { console.error('Startup cleanup error:', e); }

  if (process.env.NODE_ENV !== 'test') {
    providerManager.startPeriodicUpdates();
    providerManager.startHealthChecks();
  }

  // --- AUTH ROUTES ---
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!(username && password)) {
      res.status(400).send("All input is required");
      return;
    }

    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

    console.log(`Login attempt for: ${username}`);
    if (user) {
      const passwordIsValid = bcrypt.compareSync(password, user.password_hash);
      console.log(`User found. Password valid: ${passwordIsValid}`);

      if (passwordIsValid) {
        // Create token
        const token = jwt.sign(
          { user_id: user.id, username },
          JWT_SECRET,
          { expiresIn: "24h" }
        );
        res.json({ token, username });
        return;
      }
    } else {
      console.log('User not found');
    }
    res.status(400).send("Invalid Credentials");
  });

  // --- ADMIN ROUTES ---
  app.get('/api/admin/stats', verifyToken, (req, res) => {
    // Get global stats from DB
    const totalRequests = db.prepare('SELECT COUNT(*) as count FROM request_logs').get().count;
    const totalCost = db.prepare('SELECT SUM(cost_usd) as cost FROM request_logs').get().cost || 0;
    const avgLatency = db.prepare('SELECT AVG(latency_ms) as lat FROM request_logs').get().lat || 0;

    // Get cost over time (last 7 days)
    const dailyCosts = db.prepare(`
        SELECT date(timestamp) as date, SUM(cost_usd) as cost 
        FROM request_logs 
        WHERE timestamp >= date('now', '-7 days') 
        GROUP BY date(timestamp)
     `).all();

    // Get active/configured providers
    const providerStatus = providerManager.getProviderStatus();
    const configuredProviders = Object.values(providerStatus).filter(p => p.configured).length;
    const activeProviders = Object.values(providerStatus).filter(p => p.configured && p.health_status === 'healthy').length;

    res.json({
      totalRequests,
      totalCost,
      avgLatency,
      dailyCosts,
      configuredProviders,
      activeProviders
    });
  });

  app.get('/api/admin/providers', verifyToken, (req, res) => {
    // Return live status from memory + config from DB
    const status = providerManager.getProviderStatus();
    res.json(status);
  });

  // Manage Wrapper Keys (Client Keys)
  app.get('/api/keys', verifyToken, (req, res) => {
    const keys = db.prepare('SELECT id, name, prefix, is_active, created_at FROM wrapper_keys').all();
    res.json(keys);
  });

  app.post('/api/keys', verifyToken, (req, res) => {
    const { name, prefix: customPrefix } = req.body; // Renamed 'prefix' to 'customPrefix' to avoid conflict
    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Generate keys
    const apiKey = (customPrefix || 'sk') + '-' + randomBytes(16).toString('hex');
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    const displayPrefix = apiKey.substring(0, 10) + '...'; // Renamed 'prefix' to 'displayPrefix'

    try {
      db.prepare('INSERT INTO wrapper_keys (name, api_key_hash, prefix) VALUES (?, ?, ?)').run(name, apiKeyHash, displayPrefix);
      res.json({ api_key: apiKey, name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/keys/:id', verifyToken, (req, res) => {
    db.prepare('DELETE FROM wrapper_keys WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // --- Provider Keys Management (Dynamic Backend Keys) ---
  app.get('/api/admin/provider-keys', verifyToken, (req, res) => {
    // 1. Get DB Keys
    const dbKeys = db.prepare('SELECT id, provider_name, added_at as created_at, is_active FROM provider_keys').all();

    // 2. Get Env Keys
    const envKeys = [];
    const envMap = {
      'opencode': process.env.ZEN_API_KEY, // Zen Key
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
    };

    Object.entries(envMap).forEach(([provider, keysStr]) => {
      if (keysStr && typeof keysStr === 'string') {
        const keys = keysStr.split(',').map(k => k.trim()).filter(k => k);
        keys.forEach((key, index) => {
          envKeys.push({
            id: `env-${provider}-${index}`,
            provider_name: provider,
            created_at: null,
            is_active: 1,
            source: 'env',
            api_key: 'sk-...' + key.slice(-4)
          });
        });
      }
    });

    // Mark DB keys as source: 'db'
    const formattedDbKeys = dbKeys.map(k => ({
      ...k,
      source: 'db',
      api_key: '(hidden)' // We don't send actual DB keys to frontend for security
    }));

    res.json([...envKeys, ...formattedDbKeys]);
  });

  app.post('/api/admin/provider-keys', verifyToken, async (req, res) => {
    const { provider_name, api_key } = req.body;
    if (!provider_name || !api_key) return res.status(400).json({ error: 'Missing fields' });

    try {
      db.prepare('INSERT INTO provider_keys (provider_name, api_key) VALUES (?, ?)').run(provider_name, api_key);
      // Trigger reload
      await providerManager.reloadKeys();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/provider-keys/:id/status', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    if (id.startsWith('env-')) {
      return res.status(400).json({ error: 'Cannot toggle Environment keys via UI. Update .env file.' });
    }

    try {
      db.prepare('UPDATE provider_keys SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);
      await providerManager.reloadKeys();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/provider-keys/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    if (id.toString().startsWith('env-')) {
      return res.status(400).json({ error: 'Cannot delete Environment keys' });
    }
    db.prepare('DELETE FROM provider_keys WHERE id = ?').run(id);
    await providerManager.reloadKeys(); // Reload keys after deleting
    res.json({ success: true });
  });

  // --- Request Logs Explorer ---
  app.get('/api/admin/logs', verifyToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Filters (optional) 
    const statusFilter = req.query.status ? `AND status_code = ${req.query.status}` : '';
    const providerFilter = req.query.provider ? `AND provider = '${req.query.provider}'` : '';

    const count = db.prepare(`SELECT COUNT(*) as count FROM request_logs WHERE 1=1 ${statusFilter} ${providerFilter}`).get().count;

    const logs = db.prepare(`
        SELECT 
            r.id, 
            r.provider, 
            r.model, 
            r.latency_ms, 
            r.status_code, 
            r.cost_usd, 
            r.prompt_tokens,
            r.completion_tokens,
            r.timestamp,
            w.name as client_name
        FROM request_logs r
        LEFT JOIN wrapper_keys w ON r.wrapper_key_id = w.id
        WHERE 1=1 ${statusFilter} ${providerFilter}
        ORDER BY r.timestamp DESC
        LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({
      data: logs,
      pagination: {
        page,
        limit,
        total_pages: Math.ceil(count / limit),
        total_items: count
      }
    });
  });

  // --- Usage Aggregation Report ---
  app.get('/api/admin/usage-report', verifyToken, (req, res) => {
    // 1. Cost by Client
    const costByClient = db.prepare(`
        SELECT 
            w.name as client_name, 
            COUNT(*) as request_count, 
            SUM(r.prompt_tokens) as prompt_tokens,
            SUM(r.completion_tokens) as completion_tokens,
            SUM(r.cost_usd) as total_cost
        FROM request_logs r
        LEFT JOIN wrapper_keys w ON r.wrapper_key_id = w.id
        GROUP BY w.name
        ORDER BY total_cost DESC
    `).all();

    // 2. Cost by Provider
    const costByProvider = db.prepare(`
        SELECT 
            provider, 
            COUNT(*) as request_count, 
            SUM(cost_usd) as total_cost
        FROM request_logs
        GROUP BY provider
        ORDER BY total_cost DESC
    `).all();

    res.json({ costByClient, costByProvider });
  });

  // ... (Cron job code remains)
  // Setup cron job to ping URLs every minute
  cron.schedule('* * * * *', async () => {
    const pingUrls = process.env.PING_URLS;
    if (!pingUrls) return;

    const urls = pingUrls.split(',').map(url => url.trim());
    for (const url of urls) {
      try {
        const response = await fetch(url);
        console.log(`✅ Ping successful: ${url} - Status: ${response.status}`);
      } catch (error) {
        console.error(`❌ Ping failed: ${url} - Error: ${error.message}`);
      }
    }
  });

  // No client needed for local models - we'll make direct HTTP calls

  /**
   * @swagger
   * /v1/models:
   *   get:
   *     summary: List available models
   *     description: Lists the currently available models
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 object:
   *                   type: string
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       object:
   *                         type: string
   *                       created:
   *                         type: integer
   *                       owned_by:
   *                         type: string
   */
  app.get('/v1/models', async (req, res) => {
    try {
      console.log(`🔄 Models request from ${req.ip}:`, {
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      const allModels = [];
      const providerPromises = [];

      // Collect models from all configured providers
      Object.keys(providerManager.providers).forEach(providerName => {
        const config = providerManager.providers[providerName];
        if (config.apiKeys.length > 0) {
          providerPromises.push(
            providerManager.makeRequest(providerName, '/models', { method: 'GET' })
              .then(result => {
                if (result.data && Array.isArray(result.data)) {
                  // Add provider information to each model
                  result.data.forEach(model => {
                    allModels.push({
                      ...model,
                      provider: providerName,
                      owned_by: `${providerName}-via-opencode`
                    });
                  });
                }
              })
              .catch(error => {
                console.warn(`⚠️ Failed to get models from ${providerName}:`, error.message);
                // Add fallback models for this provider
                config.models.forEach(modelId => {
                  allModels.push({
                    id: modelId,
                    object: 'model',
                    created: Math.floor(Date.now() / 1000),
                    owned_by: `${providerName}-via-opencode`,
                    provider: providerName
                  });
                });
              })
          );
        }
      });

      // Wait for all provider requests to complete
      await Promise.allSettled(providerPromises);

      // Remove duplicates based on model ID
      const uniqueModels = allModels.filter((model, index, self) =>
        index === self.findIndex(m => m.id === model.id)
      );

      const result = {
        object: 'list',
        data: uniqueModels
      };

      console.log(`✅ Models response sent to ${req.ip}: ${result.data.length} models from ${Object.keys(providerManager.providers).length} providers`);
      res.json(result);

    } catch (error) {
      console.error(`❌ Models error for ${req.ip}:`, error.message);

      // Return basic fallback models
      res.json({
        object: 'list',
        data: [
          {
            id: 'grok-code',
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'opencode'
          },
          {
            id: 'code-supernova',
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'opencode'
          }
        ]
      });
    }
  });

  /**
   *                   type: integer
   *                 model:
   *                   type: string
   *                 choices:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       index:
   *                         type: integer
   *                       message:
   *                         type: object
   *                         properties:
   *                           role:
   *                             type: string
   *                           content:
   *                             type: string
   *                       finish_reason:
   *                         type: string
   *                 usage:
   *                   type: object
   *                   properties:
   *                     prompt_tokens:
   *                       type: integer
   *                     completion_tokens:
   *                       type: integer
   *                     total_tokens:
   *                       type: integer
   *       500:
   *         description: Internal server error
   */


  app.post('/v1/chat/completions', verifyWrapperKey, async (req, res) => {
    const startTime = Date.now();

    try {
      const { messages, model, stream, tools, temperature, max_tokens } = req.body;

      console.log(`🔄 Chat completion request from ${req.ip}:`, {
        model: model,
        messageCount: messages?.length,
        stream: stream || false,
        toolsCount: tools?.length,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        console.log(`❌ Invalid request: Empty messages array from ${req.ip}`);
        return res.status(400).json({ error: 'Messages array is required and cannot be empty' });
      }

      // Use model from request or default (but we'll override with provider's best model)
      const requestedModel = model || process.env.DEFAULT_MODEL || 'grok-code';

      // Process messages to flatten content to string, converting images to text
      const processedMessages = messages.map(msg => {
        if (Array.isArray(msg.content)) {
          msg.content = msg.content.map(item => {
            if (item.type === 'image_url') {
              return '[Image: ' + item.image_url.url + ']';
            }
            return item.text;
          }).join(' ');
        }
        return msg;
      });

      // Try providers with fallback logic
      const orderedProviders = providerManager.getOrderedProviders();

      // Check for forced provider (Admin testing)
      const forcedProvider = req.headers['x-force-provider'];
      let providersToTry = orderedProviders.slice(0, 3);

      if (forcedProvider) {
        if (providerManager.providers[forcedProvider]) {
          console.log(`⚠️ Forcing provider: ${forcedProvider}`);
          providersToTry = [forcedProvider];
        } else {
          return res.status(400).json({ error: `Forced provider '${forcedProvider}' not configured or unknown` });
        }
      }

      let lastError = null;
      let success = false;
      let responseSent = false;

      for (const selectedProvider of providersToTry) {
        if (success) break;

        try {
          const actualModel = providerManager.getBestModelForProvider(selectedProvider);
          console.log(`🎯 Attempting provider: ${selectedProvider} with model: ${actualModel}`);

          const result = await providerManager.makeRequest(selectedProvider, '/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
              model: actualModel,
              messages: processedMessages, // Use processedMessages
              temperature,
              max_tokens,
              stream: stream || false, // Keep original stream logic
              ...(tools && { tools }) // Keep original tools logic
            }),
            // Pass ID for tracking
            wrapperKeyId: req.wrapperKeyId,
            stream: stream || false
          });

          // Override the model in response to match what user requested
          if (result.model) {
            result.model = requestedModel;
          }

          // Handle Streaming Response
          if (stream && result.body) {
            console.log(`✅ Chat completion streaming response started to ${req.ip} via ${selectedProvider}:`, {
              model: actualModel,
              status: 'streaming'
            });

            // Set headers for SSE
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            let nodeStream = result.body;
            // Convert Web Stream to Node Stream if needed (Node 20+ native fetch)
            if (typeof result.body.pipe !== 'function') {
              const { Readable } = await import('stream');
              try {
                nodeStream = Readable.fromWeb(result.body);
              } catch (e) {
                console.warn('Failed to convert Web Stream to Node Stream, falling back to raw body:', e);
              }
            }

            // Create a pseudo-response object for trackStreamAndLog if we replaced the body
            const responseForTracker = { ...result, body: nodeStream };

            trackStreamAndLog(responseForTracker, res, db, {
              wrapperKeyId: req.wrapperKeyId,
              provider: selectedProvider,
              model: actualModel,
              startTime: startTime,
              ip: req.ip
            });
            success = true;
            return; // Exit request handler, stream handles the rest
          }

          console.log(`🔍 Provider Response (${selectedProvider}):`, JSON.stringify(result, null, 2));

          console.log(`✅ Chat completion response sent to ${req.ip} via ${selectedProvider}:`, {
            requestedModel,
            actualModel,
            tokens: result.usage,
            responseLength: result.choices?.[0]?.message?.content?.length,
            toolCalls: result.choices?.[0]?.message?.tool_calls?.length,
            totalTime: Date.now() - startTime,
            status: 'success'
          });

          // Log Successful Request to DB
          try {
            let usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };

            // DEBUG: Write usage to file
            try {
              const fs = require('fs');
              fs.writeFileSync('debug_usage.json', JSON.stringify({ provider: selectedProvider, usage }, null, 2));
            } catch (e) { }

            let finalCost = 0;

            // Pricing Defaults (USD per 1M tokens)
            const PRICING = {
              'openai': { input: 2.50, output: 10.00 },
              'anthropic': { input: 3.00, output: 15.00 },
              'google': { input: 0.35, output: 1.05 },
              'mistral': { input: 2.00, output: 6.00 },
              'groq': { input: 0.59, output: 0.79 },
              'cerebras': { input: 0.00, output: 0.00 },
              'together': { input: 0.20, output: 0.20 },
              'deepseek': { input: 0.14, output: 0.28 },
              'nvidia': { input: 0.65, output: 2.20 }, // Estimates
              'default': { input: 0.50, output: 1.50 }
            };

            const pricing = PRICING[selectedProvider] || PRICING['default'];
            const inputCost = (usage.prompt_tokens / 1000000) * pricing.input;
            const outputCost = (usage.completion_tokens / 1000000) * pricing.output;
            finalCost = inputCost + outputCost;

            db.prepare(`
               INSERT INTO request_logs (wrapper_key_id, provider, model, prompt_tokens, completion_tokens, latency_ms, status_code, cost_usd)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             `).run(
              req.wrapperKeyId,
              selectedProvider,
              actualModel,
              usage.prompt_tokens || 0,
              usage.completion_tokens || 0,
              Date.now() - startTime,
              200,
              finalCost
            );
          } catch (logErr) {
            console.error('Logging failed:', logErr);
          }

          success = true;
          responseSent = true;
          return res.json(result);

        } catch (error) {
          console.warn(`⚠️ Provider ${selectedProvider} failed:`, error.message);

          // DEBUG: Write error to file
          try {
            const fs = require('fs');
            fs.writeFileSync('debug_error.json', JSON.stringify({ provider: selectedProvider, error: error.message, stack: error.stack }, null, 2));
          } catch (e) { }

          lastError = error;
          // Continue to next provider in loop
        }
      }

      // If we exhausted all providers
      if (!success) {
        console.error(`❌ All top providers failed, trying fallback to opencode`);
      }

      // Final fallback to opencode if all providers failed
      try {
        console.log(`🔄 Falling back to opencode for ${req.ip}`);

        const zenApiKey = process.env.ZEN_API_KEY;
        if (!zenApiKey || zenApiKey === 'your-zen-api-key-here') {
          throw new Error('Zen API key not configured. Please set ZEN_API_KEY in your .env file.');
        }

        const zenBaseUrl = process.env.ZEN_BASE_URL || 'https://opencode.ai/zen/v1';

        // Use grok-code for opencode fallback
        const fallbackRequestBody = {
          model: 'grok-code',
          messages: processedMessages,
          stream: stream || false,
          ...(tools && { tools })
        };

        console.log(`📤 Sending to Zen fallback:`, { body: JSON.stringify(fallbackRequestBody, null, 2) });

        const response = await fetch(`${zenBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${zenApiKey}`,
          },
          body: JSON.stringify(fallbackRequestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Zen API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        if (stream) {
          // Handle streaming response
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          console.log(`✅ Chat completion streaming fallback response started to ${req.ip} via opencode:`, {
            model: requestedModel,
            totalTime: Date.now() - startTime,
            status: 'streaming'
          });

          trackStreamAndLog(response, res, db, {
            wrapperKeyId: req.wrapperKeyId,
            provider: 'opencode', // Fallback provider
            model: 'grok-code',   // Fallback model
            startTime: startTime,
            ip: req.ip
          });
          return;
        } else {
          const result = await response.json();
          console.log(`✅ Chat completion fallback response sent to ${req.ip} via opencode:`, {
            model: requestedModel,
            tokens: result.usage,
            responseLength: result.choices?.[0]?.message?.content?.length,
            toolCalls: result.choices?.[0]?.message?.tool_calls?.length,
            totalTime: Date.now() - startTime,
            status: 'success'
          });

          // Fallback Logging & Cost Calculation
          try {
            let usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
            let finalCost = 0;
            // Opencode Pricing (Approximate)
            const inputCost = (usage.prompt_tokens / 1000000) * 0.50;
            const outputCost = (usage.completion_tokens / 1000000) * 1.50;
            finalCost = inputCost + outputCost;

            db.prepare(`
               INSERT INTO request_logs (wrapper_key_id, provider, model, prompt_tokens, completion_tokens, latency_ms, status_code, cost_usd)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             `).run(
              req.wrapperKeyId,
              'opencode', // Provider is opencode (fallback)
              'grok-code',
              usage.prompt_tokens || 0,
              usage.completion_tokens || 0,
              Date.now() - startTime,
              200,
              finalCost
            );
          } catch (logErr) {
            console.error('Fallback logging failed:', logErr);
          }

          res.json(result);
        }

      } catch (fallbackError) {
        console.error(`❌ Final fallback also failed for ${req.ip}:`, fallbackError.message);
        throw fallbackError;
      }

    } catch (error) {
      console.error(`❌ Chat completion error for ${req.ip}:`, {
        error: error.message,
        model: req.body.model,
        totalTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });

      // Send error response
      res.status(500).json({
        error: {
          message: error.message || 'Internal server error',
          type: error.name || 'internal_error'
        }
      });
    }
  });

  /**
   * @swagger
   * /v1/audio/speech:
   *   post:
   *     summary: Generates audio from the input text.
   *     tags: [Audio]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - model
   *               - input
   *               - voice
   *             properties:
   *               model:
   *                 type: string
   *                 description: The model to use for generating audio.
   *               input:
   *                 type: string
   *                 description: The text to generate audio for.
   *               voice:
   *                 type: string
   *                 description: The voice to use for the audio.
   *     responses:
   *       200:
   *         description: Audio file content.
   *         content:
   *           audio/mpeg:
   *             schema:
   *               type: string
   *               format: binary
   */
  app.post('/v1/audio/speech', verifyWrapperKey, async (req, res) => {
    const startTime = Date.now();
    try {
      const { model, input, voice, speed } = req.body;

      console.log(`🗣️ TTS request from ${req.ip}:`, {
        model,
        inputLength: input?.length,
        voice,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      if (!input) {
        return res.status(400).json({ error: 'Input text is required' });
      }

      // Map OpenAI voices to Edge TTS voices
      const voiceMap = {
        'alloy': 'en-US-AvaMultilingualNeural',
        'echo': 'en-US-AndrewMultilingualNeural',
        'fable': 'en-GB-RyanNeural',
        'onyx': 'en-US-BrianMultilingualNeural',
        'nova': 'en-US-EmmaMultilingualNeural',
        'shimmer': 'en-US-JennyNeural'
      };

      // Use mapped voice or fallback to the provided voice (if it's already an Edge voice) or default
      const selectedVoice = voiceMap[voice] || voice || 'en-US-EmmaMultilingualNeural';

      // Edge TTS options
      const options = {
        voice: selectedVoice,
        rate: speed ? `${(speed - 1) * 100}%` : '+0%' // Convert 1.0 to 0%, 1.25 to +25%
      };

      const communicate = new Communicate(input, options);

      // Set headers for audio response
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Transfer-Encoding', 'chunked');

      for await (const chunk of communicate.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
          res.write(chunk.data);
        }
      }

      res.end();

      console.log(`✅ TTS response sent to ${req.ip} using voice ${selectedVoice}`);

      // Log request
      try {
        const inputCost = (input.length / 1000) * 0.015; // Approx cost calculation
        db.prepare(`
           INSERT INTO request_logs (wrapper_key_id, provider, model, prompt_tokens, completion_tokens, latency_ms, status_code, cost_usd)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         `).run(
          req.wrapperKeyId,
          'edge-tts',
          model || 'tts-1',
          input.length, // Using chars as "tokens" for rough logging
          0,
          Date.now() - startTime,
          200,
          inputCost
        );
      } catch (logErr) {
        console.error('TTS logging failed:', logErr);
      }

    } catch (error) {
      console.error(`❌ TTS error for ${req.ip}:`, error.message);
      res.status(500).json({
        error: {
          message: error.message || 'Internal server error',
          type: 'tts_error'
        }
      });
    }
  });
  // MCP Tool Execution Endpoint
  app.post('/v1/tools/execute', async (req, res) => {
    try {
      const { server, tool, arguments: args } = req.body;

      console.log(`🔧 MCP tool execution from ${req.ip}:`, {
        server,
        tool,
        argsCount: args ? Object.keys(args).length : 0,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      if (!server || !tool) {
        return res.status(400).json({ error: 'Server and tool are required' });
      }

      const result = await executeMCPTool(server, tool, args || {});

      console.log(`✅ MCP tool executed for ${req.ip}:`, {
        server,
        tool,
        success: true
      });

      res.json(result);
    } catch (error) {
      console.error(`❌ MCP tool execution error for ${req.ip}:`, {
        error: error.message,
        server: req.body.server,
        tool: req.body.tool,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({
        error: {
          message: error.message || 'MCP tool execution failed',
          type: 'mcp_error'
        }
      });
    }
  });

  // Admin Endpoints for Provider Monitoring
  app.get('/admin/providers/stats', (req, res) => {
    try {
      const stats = providerManager.getStats();
      res.json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  app.get('/admin/providers/status', (req, res) => {
    try {
      const status = providerManager.getProviderStatus();
      res.json({
        status: 'success',
        data: status
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  app.post('/admin/providers/reset', (req, res) => {
    try {
      // This would reset stats - in a real implementation you'd want authentication
      providerManager.stats = {
        providers: {},
        last_updated: new Date().toISOString(),
        version: 1
      };
      providerManager.initializeProviders();
      providerManager.saveStats();

      res.json({
        status: 'success',
        message: 'Provider stats reset successfully'
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  });

  // Serve static files from React frontend
  app.use(express.static(path.join(__dirname, 'client/dist')));

  // Handle React routing, return all requests to React app
  app.get(/.*/, (req, res) => {
    // Skip API routes to avoid index.html being returned for API 404s
    if (req.path.startsWith('/v1/') || req.path.startsWith('/api/') || req.path.startsWith('/admin/')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
  });

  const port = process.env.PORT || 3010;
  app.listen(port, () => console.log(`OpenAI-like wrapper running on port ${port}`));
}

start();