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
import { User, ProviderKey, WrapperKey, RequestLog, ModelPricing, ProviderStats } from './db/mongo.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash, randomUUID } from 'crypto';
import crypto from 'crypto';
import { trackStreamAndLog } from './utils/streamTracker.js';
import { getPricing, calculateCost } from './utils/pricing.js';
import { sendBackupEmail } from './utils/emailService.js';
import { Communicate } from 'edge-tts-universal';
import { Whisk } from "@rohitaryal/whisk-api";

dotenv.config({ path: path.resolve('/root/opencode-wrapper-main', '.env') });

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

const imageCache = new Map();

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
// const skipRateLimit = process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true';
// if (!skipRateLimit) {
//   app.use('/v1/', limiter);
// }

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
const verifyWrapperKey = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  // 1. Allow Admin JWT (for Playground/Testing)
  const token = req.headers['x-access-token'] || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      req.wrapperKeyId = null;
      return next();
    } catch (e) {
      // Not a valid JWT, continue to check as API Key
    }
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    try {
      await new RequestLog({ provider: 'system', model: 'auth-missing', status_code: 401, cost_usd: 0 }).save();
    } catch (e) { console.error('Failed to log auth error:', e); }

    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const apiKey = authHeader.split(' ')[1];

  try {
    const hash = createHash('sha256').update(apiKey).digest('hex');
    const keyRecord = await WrapperKey.findOne({ api_key_hash: hash, is_active: true });

    if (keyRecord) {
      req.wrapperKeyId = keyRecord._id;
      return next();
    }
  } catch (err) {
    console.error("Key verification error:", err.message);
  }

  try {
    await new RequestLog({ provider: 'system', model: 'auth-invalid', status_code: 401, cost_usd: 0 }).save();
  } catch (e) { console.error('Failed to log auth error:', e); }

  return res.status(401).json({ error: 'Invalid API Key' });
};

async function start() {
  // Initialize Database First
  await initDB();

  // Initialize Provider Manager
  const providerManager = new ProviderManager();
  await providerManager.reloadKeys(); // Load dynamic keys from DB

  // Log Cleanup Task (Daily at midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('🧹 Running daily log cleanup...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Check for old logs first
      const oldLogs = await RequestLog.find({ timestamp: { $lt: thirtyDaysAgo } });

      if (oldLogs.length > 0) {
        console.log(`Found ${oldLogs.length} old logs to delete. Sending backup first...`);
        try {
          if (process.env.OWNER_MAIL) {
            await sendBackupEmail(process.env.OWNER_MAIL, oldLogs);
            console.log('✅ Backup email sent successfully. Proceeding with deletion.');
          } else {
            console.log('⚠️ No owner email configured, logs will be deleted without backup.');
          }

          const result = await RequestLog.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });
          console.log(`✅ Deleted ${result.deletedCount} old request logs`);

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
    const result = await RequestLog.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });
    if (result.deletedCount > 0) console.log(`🧹 Cleanup on startup: Deleted ${result.deletedCount} old logs`);
  } catch (e) { console.error('Startup cleanup error:', e); }

  if (process.env.NODE_ENV !== 'test') {
    providerManager.startPeriodicUpdates();
    providerManager.startHealthChecks();
  }

  // Cleanup Image Cache every 10 minutes
  setInterval(() => {
    if (imageCache.size > 0) {
      const now = Date.now();
      let deleted = 0;
      for (const [key, value] of imageCache.entries()) {
        if (now - value.timestamp > 3600000) { // 1 hour expiration
          imageCache.delete(key);
          deleted++;
        }
      }
      if (deleted > 0) console.log(`🧹 Cleaned up ${deleted} expired images from cache`);
    }
  }, 600000);

  // --- Auth Routes ---
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!(username && password)) {
      return res.status(400).send("All input is required");
    }

    const adminUser = process.env.ADMIN_USER;
    const adminPass = process.env.ADMIN_PASS;

    // Authenticate against env credentials
    if (adminUser && adminPass && username === adminUser && password === adminPass) {
      const token = jwt.sign(
        { user_id: 'admin', username },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      return res.json({ token, username });
    }

    // Fallback: check DB for additional admin users
    try {
      const user = await User.findOne({ username });
      if (user && bcrypt.compareSync(password, user.password_hash)) {
        const token = jwt.sign(
          { user_id: user._id, username },
          JWT_SECRET,
          { expiresIn: "24h" }
        );
        return res.json({ token, username });
      }
    } catch (err) {
      console.error('Login error:', err);
    }

    res.status(400).send("Invalid Credentials");
  });

  // --- ADMIN ROUTES ---
  app.get('/api/admin/stats', verifyToken, async (req, res) => {
    try {
      const totalRequests = await RequestLog.countDocuments();
      const costs = await RequestLog.aggregate([{ $group: { _id: null, total: { $sum: "$cost_usd" } } }]);
      const totalCost = costs[0]?.total || 0;
      const latency = await RequestLog.aggregate([{ $group: { _id: null, avg: { $avg: "$latency_ms" } } }]);
      const avgLatency = latency[0]?.avg || 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const dailyCosts = await RequestLog.aggregate([
        { $match: { timestamp: { $gte: sevenDaysAgo } } },
        { $group: { 
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            cost: { $sum: "$cost_usd" }
          }
        },
        { $project: { date: "$_id", cost: 1, _id: 0 } },
        { $sort: { date: 1 } }
      ]);

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
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/providers', verifyToken, (req, res) => {
    const status = providerManager.getProviderStatus();
    res.json(status);
  });

  app.get('/admin/providers', (req, res) => {
    const status = providerManager.getProviderStatus();
    res.json(status);
  });

  app.get('/api/keys', verifyToken, async (req, res) => {
    try {
      const keys = await WrapperKey.find({}, { name: 1, prefix: 1, is_active: 1, created_at: 1 });
      res.json(keys);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/keys', verifyToken, async (req, res) => {
    const { name, prefix: customPrefix } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const apiKey = (customPrefix || 'sk') + '-' + randomBytes(16).toString('hex');
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
    const displayPrefix = apiKey.substring(0, 10) + '...';

    try {
      await new WrapperKey({ name, api_key_hash: apiKeyHash, prefix: displayPrefix }).save();
      res.json({ api_key: apiKey, name });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/keys/:id', verifyToken, async (req, res) => {
    try {
      await WrapperKey.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/provider-keys', verifyToken, async (req, res) => {
    try {
      const dbKeys = await ProviderKey.find({}, { provider_name: 1, is_active: 1, added_at: 1 });
      
      const envKeys = [];
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

      Object.entries(envMap).forEach(([provider, keysStr]) => {
        if (keysStr && typeof keysStr === 'string') {
          keysStr.split(',').map(k => k.trim()).filter(k => k).forEach((key, index) => {
            envKeys.push({
              _id: `env-${provider}-${index}`,
              provider_name: provider,
              created_at: null,
              is_active: 1,
              source: 'env',
              api_key: 'sk-...' + key.slice(-4)
            });
          });
        }
      });

      const formattedDbKeys = dbKeys.map(k => ({
        ...k.toObject(),
        source: 'db',
        api_key: '(hidden)'
      }));

      res.json([...envKeys, ...formattedDbKeys]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/provider-keys', verifyToken, async (req, res) => {
    const { provider_name, api_key } = req.body;
    if (!provider_name || !api_key) return res.status(400).json({ error: 'Missing fields' });

    try {
      await new ProviderKey({ provider_name, api_key }).save();
      await providerManager.reloadKeys();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/admin/provider-keys/:id/status', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    if (id.startsWith('env-')) return res.status(400).json({ error: 'Cannot toggle Env keys' });

    try {
      await ProviderKey.findByIdAndUpdate(id, { is_active });
      await providerManager.reloadKeys();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/provider-keys/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    if (id.startsWith('env-')) return res.status(400).json({ error: 'Cannot delete Env keys' });
    try {
      await ProviderKey.findByIdAndDelete(id);
      await providerManager.reloadKeys();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/logs', verifyToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.status) query.status_code = parseInt(req.query.status);
    if (req.query.provider) query.provider = req.query.provider;

    try {
      const count = await RequestLog.countDocuments(query);
      const logs = await RequestLog.find(query)
        .populate('wrapper_key_id', 'name')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);

      res.json({
        data: logs.map(l => ({ ...l.toObject(), client_name: l.wrapper_key_id?.name || 'system' })),
        pagination: {
          page,
          limit,
          total_pages: Math.ceil(count / limit),
          total_items: count
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Usage Aggregation Report ---
  app.get('/api/admin/usage-report', verifyToken, async (req, res) => {
    try {
      // 1. Cost by Client
      const costByClient = await RequestLog.aggregate([
        {
          $group: {
            _id: "$wrapper_key_id",
            request_count: { $sum: 1 },
            prompt_tokens: { $sum: "$prompt_tokens" },
            completion_tokens: { $sum: "$completion_tokens" },
            total_cost: { $sum: "$cost_usd" }
          }
        },
        {
          $lookup: {
            from: "wrapperkeys",
            localField: "_id",
            foreignField: "_id",
            as: "client"
          }
        },
        {
          $project: {
            client_name: { $ifNull: [{ $arrayElemAt: ["$client.name", 0] }, "system"] },
            request_count: 1,
            prompt_tokens: 1,
            completion_tokens: 1,
            total_cost: 1
          }
        },
        { $sort: { total_cost: -1 } }
      ]);

      // 2. Cost by Provider
      const costByProvider = await RequestLog.aggregate([
        {
          $group: {
            _id: "$provider",
            request_count: { $sum: 1 },
            total_cost: { $sum: "$cost_usd" }
          }
        },
        {
          $project: {
            provider: "$_id",
            request_count: 1,
            total_cost: 1,
            _id: 0
          }
        },
        { $sort: { total_cost: -1 } }
      ]);

      res.json({ costByClient, costByProvider });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

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

  // --- Image Generation Route ---
  app.post('/v1/images/generations', verifyWrapperKey, async (req, res) => {
    try {
      const { prompt, n = 1, size = "1024x1024" } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: { message: "Prompt is required" } });
      }

      console.log(`[Whisk] Generating image for prompt: ${prompt}`);

      // Check if Whisk is configured
      if (!process.env.COOKIE_WHISK) {
        return res.status(500).json({ error: { message: "Image generation service not configured (missing COOKIE_WHISK)" } });
      }

      const whisk = new Whisk(process.env.COOKIE_WHISK);
      const project = await whisk.newProject("OpenCode Wrapper Project");
      const media = await project.generateImage(prompt);

      if (media && media.encodedMedia) {
        const imageId = randomUUID();
        // Store for 1 hour
        imageCache.set(imageId, { media, timestamp: Date.now() });

        res.json({
          created: Math.floor(Date.now() / 1000),
          data: [
            {
              b64_json: media.encodedMedia,
              id: imageId // Custom field to allow refinement
            }
          ]
        });
      } else {
        throw new Error("Failed to generate image or no data returned");
      }

    } catch (error) {
      console.error("Image generation error:", error);
      res.status(500).json({ error: { message: error.message || "Internal Server Error" } });
    }
  });

  // --- Image Edit/Refine Route ---
  app.post('/v1/images/edits', verifyWrapperKey, async (req, res) => {
    try {
      const { image, prompt, n = 1, size = "1024x1024" } = req.body;

      if (!image) return res.status(400).json({ error: { message: "Image ID is required" } });
      if (!prompt) return res.status(400).json({ error: { message: "Prompt is required" } });

      console.log(`[Whisk] Refining image ${image} with prompt: ${prompt}`);

      const cached = imageCache.get(image);
      if (!cached || !cached.media) {
        console.log(`Cache lookup failed for ID: ${image}. Cache size: ${imageCache.size}`);
        return res.status(404).json({ error: { message: "Image not found or expired. You can only refine images generated recently by this server." } });
      }

      const refinedMedia = await cached.media.refine(prompt);

      if (refinedMedia && refinedMedia.encodedMedia) {
        const newImageId = randomUUID();
        imageCache.set(newImageId, { media: refinedMedia, timestamp: Date.now() });

        res.json({
          created: Math.floor(Date.now() / 1000),
          data: [
            {
              b64_json: refinedMedia.encodedMedia,
              id: newImageId
            }
          ]
        });
      } else {
        throw new Error("Failed to refine image");
      }

    } catch (error) {
      console.error("Image refine error:", error);
      res.status(500).json({ error: { message: error.message || "Internal Server Error" } });
    }
  });


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
      const allModels = [];
      const providerPromises = [];

      // Helper to check if provider has valid API keys
      const isProviderConfigured = (config) => {
        return config.apiKeys && config.apiKeys.length > 0 &&
          config.apiKeys.some(key => key && key.trim() !== '' && 
            key !== 'your-api-key-here' && key !== 'your-zen-api-key-here');
      };

      // Collect models from all configured providers
      Object.keys(providerManager.providers).forEach(providerName => {
        const config = providerManager.providers[providerName];
        if (isProviderConfigured(config)) {
          providerPromises.push(
            providerManager.makeRequest(providerName, '/models', { method: 'GET' })
              .then(result => {
                const models = result.data || result.models;
                if (models && Array.isArray(models)) {
                  // Add provider information to each model
                  models.forEach(model => {
                    allModels.push({
                      ...model,
                      id: model.id || (model.name ? model.name.split('/').pop() : 'unknown'),
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

      res.json({
        object: 'list',
        data: uniqueModels
      });
    } catch (error) {
      console.error('❌ Error fetching models:', error);
      res.status(500).json({ error: { message: 'Internal server error', type: 'internal_error' } });
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


  app.post('/api/v1/chat/completions', verifyWrapperKey, (req, res, next) => { req.url = '/v1/chat/completions'; next(); });
app.post('/v1/chat/completions', verifyWrapperKey, async (req, res) => {
    const startTime = Date.now();

    try {
      const { messages, model, stream, tools, temperature, max_tokens } = req.body;

      if (process.env.NODE_ENV !== 'production') {
        console.log(`🔄 Chat completion request from ${req.ip}:`, {
          model: model,
          messageCount: messages?.length,
          stream: stream || false,
          toolsCount: tools?.length,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        console.log(`❌ Invalid request: Empty messages array from ${req.ip}`);
        return res.status(400).json({ error: 'Messages array is required and cannot be empty' });
      }

      // Check if any message contains an image_url
      const hasImages = messages.some(msg =>
        Array.isArray(msg.content) && msg.content.some(item => item.type === 'image_url')
      );

      // Smart model selection: if no model specified, pick best available
      let requestedModel = model;
      let smartProvider = null;
      
      if (!requestedModel || requestedModel.trim() === '') {
        const best = providerManager.getBestModel(hasImages);
        requestedModel = best.model;
        smartProvider = best.provider;
      } else {
        requestedModel = model;
      }

      // Process messages: flatten to string ONLY if no images are present
      // Vision models require the original array structure
      const processedMessages = hasImages ? messages : messages.map(msg => {
        if (Array.isArray(msg.content)) {
          const flattened = msg.content.map(item => {
            if (item.type === 'image_url') {
              return '[Image: ' + item.image_url.url + ']';
            }
            return item.text;
          }).join(' ');
          return { ...msg, content: flattened };
        }
        return msg;
      });

      // Try providers with fallback logic
      let orderedProviders = providerManager.getOrderedProviders({ requiresVision: hasImages });

      // Check for forced provider (Admin testing)
      const forcedProvider = req.headers['x-force-provider'];
      let providersToTry = orderedProviders.slice(0, 3);

      // If smart selection was used, prioritize that provider
      if (smartProvider && !forcedProvider && orderedProviders.includes(smartProvider)) {
        providersToTry = [smartProvider, ...providersToTry.filter(p => p !== smartProvider)].slice(0, 3);
      }

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
          const actualModel = providerManager.getBestModelForProvider(selectedProvider, hasImages);
          console.log(`🎯 Attempting provider: ${selectedProvider} with model: ${actualModel} (Vision: ${hasImages})`);

          const result = await providerManager.makeRequest(selectedProvider, '/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
              model: actualModel,
              messages: processedMessages,
              temperature,
              max_tokens,
              stream: stream || false,
              ...(tools && { tools })
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

          // Only log in non-production
          if (process.env.NODE_ENV !== 'production') {
            console.log(`🔍 Provider Response (${selectedProvider}):`, JSON.stringify(result, null, 2));
          }

          console.log(`✅ Chat completion response sent to ${req.ip} via ${selectedProvider}:`, {
            requestedModel,
            actualModel,
            tokens: result.usage,
            responseLength: result.choices?.[0]?.message?.content?.length,
            toolCalls: result.choices?.[0]?.message?.tool_calls?.length,
            totalTime: Date.now() - startTime,
            status: 'success'
          });

          // Log Successful Request to MongoDB
          try {
            const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
            const finalCost = await calculateCost(usage, selectedProvider, actualModel);

            await new RequestLog({
              wrapper_key_id: req.wrapperKeyId,
              provider: selectedProvider,
              model: actualModel,
              prompt_tokens: usage.prompt_tokens || 0,
              completion_tokens: usage.completion_tokens || 0,
              latency_ms: Date.now() - startTime,
              status_code: 200,
              cost_usd: finalCost
            }).save();

          } catch (logErr) {
            console.error('Logging failed:', logErr);
          }

          success = true;
          responseSent = true;
          return res.json(result);

        } catch (error) {
          console.warn(`⚠️ Provider ${selectedProvider} failed:`, error.message);

          lastError = error;
          // Continue to next provider in loop
        }
      }

      // If we exhausted all providers
      if (!success) {
        console.error(`❌ All top providers failed, trying fallback to opencode`);
      }

      // Only fallback to opencode if NOT using forced provider
      if (!forcedProvider) {
        // Final fallback to opencode if all providers failed
        try {
          console.log(`🔄 Falling back to opencode for ${req.ip}`);

          const zenApiKey = process.env.ZEN_API_KEY;
          if (!zenApiKey || zenApiKey === 'your-zen-api-key-here') {
            throw new Error('Zen API key not configured. Please set ZEN_API_KEY in your .env file.');
          }

          const zenBaseUrl = process.env.ZEN_BASE_URL || 'https://opencode.ai/zen/v1';

          // Use minimax-m2.5-free for opencode fallback
          const fallbackRequestBody = {
            model: 'minimax-m2.5-free',
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

            trackStreamAndLog(response, res, {
              wrapperKeyId: req.wrapperKeyId,
              provider: 'opencode', // Fallback provider
              model: 'minimax-m2.5-free',   // Fallback model
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
              const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 };
              const finalCost = await calculateCost(usage, 'opencode', 'minimax-m2.5-free');

              await new RequestLog({
                wrapper_key_id: req.wrapperKeyId,
                provider: 'opencode',
                model: 'minimax-m2.5-free',
                prompt_tokens: usage.prompt_tokens || 0,
                completion_tokens: usage.completion_tokens || 0,
                latency_ms: Date.now() - startTime,
                status_code: 200,
                cost_usd: finalCost
              }).save();
            } catch (logErr) {
              console.error('Fallback logging failed:', logErr);
            }

            res.json(result);
          }

        } catch (fallbackError) {
          console.error(`❌ Final fallback also failed for ${req.ip}:`, fallbackError.message);
          throw fallbackError;
        }
      } else {
        // If forced provider failed and we're not falling back, throw the original error
        throw lastError || new Error(`Forced provider '${forcedProvider}' failed`);
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

  // Admin Model Pricing Endpoints
  app.get('/api/admin/pricing', verifyToken, async (req, res) => {
    try {
      const pricing = await ModelPricing.find().sort({ provider: 1, model: 1 }).lean();
      // Map _id to id for frontend compatibility
      res.json(pricing.map(p => ({ ...p, id: p._id })));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/pricing', verifyToken, async (req, res) => {
    try {
      const { provider, model, input_cost_per_1m, output_cost_per_1m } = req.body;

      if (!provider || !model) {
        return res.status(400).json({ error: 'Provider and Model are required' });
      }

      await ModelPricing.findOneAndUpdate(
        { provider, model },
        { input_cost_per_1m: input_cost_per_1m || 0, output_cost_per_1m: output_cost_per_1m || 0, updated_at: new Date() },
        { upsert: true, new: true }
      );

      if (providerManager.pricingCache) {
        providerManager.pricingCache.delete(`${provider}:${model}`);
        if (model === '*') {
          providerManager.pricingCache.clear();
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/admin/pricing/:id', verifyToken, async (req, res) => {
    try {
      const { id } = req.params;
      const pricingRow = await ModelPricing.findById(id);

      await ModelPricing.findByIdAndDelete(id);

      if (pricingRow && providerManager.pricingCache) {
        providerManager.pricingCache.delete(`${pricingRow.provider}:${pricingRow.model}`);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // No static file serving - Pure API mode
  app.get('/', (req, res) => {
    res.json({
      status: "active",
      service: "Opencode Wrapper API",
      version: "1.0.0",
      endpoints: [
        "/v1/chat/completions",
        "/v1/images/generations",
        "/v1/images/edits",
        "/v1/models"
      ]
    });
  });

  // 404 handler for undefined routes
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  const port = process.env.PORT || 3010;
  app.listen(port, () => console.log(`OpenAI-like wrapper running on port ${port}`));
}

start();