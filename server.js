import fs from 'fs';
import 'dotenv/config';
import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { Readable } from 'stream';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import ProviderManager from './providerManager.js';

const app = express();

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

async function start() {
  // Initialize Provider Manager
  const providerManager = new ProviderManager();
  console.log('🚀 Provider Manager initialized with', Object.keys(providerManager.providers).length, 'providers');

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
    * @swagger
    * /v1/chat/completions:
    *   post:
    *     summary: Create a chat completion
    *     description: Creates a completion for the chat message. Supports text and images (images embedded as base64 in text prompts).
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               messages:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     role:
   *                       type: string
   *                       enum: [user, assistant]
   *                     content:
   *                       type: string
   *               model:
   *                 type: string
   *                 example: gpt-3.5-turbo
   *     responses:
   *       200:
   *         description: Successful response
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 object:
   *                   type: string
   *                 created:
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


  app.post('/v1/chat/completions', async (req, res) => {
    const startTime = Date.now();

    try {
      const { messages, model, stream, tools } = req.body;

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
        let lastError = null;
        const maxRetries = 1;

       for (let attempt = 0; attempt < maxRetries; attempt++) {
         try {
           const selectedProvider = providerManager.selectProvider();
           const actualModel = providerManager.getBestModelForProvider(selectedProvider);
           console.log(`🎯 Selected provider: ${selectedProvider} with model: ${actualModel} (attempt ${attempt + 1}/${maxRetries})`);

           const requestBody = {
             model: actualModel,
             messages: processedMessages,
             stream: stream || false,
             ...(tools && { tools })
           };

           const result = await providerManager.makeRequest(selectedProvider, '/chat/completions', {
             method: 'POST',
             body: JSON.stringify(requestBody)
           });

           // Override the model in response to match what user requested
           if (result.model) {
             result.model = requestedModel;
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

           return res.json(result);

         } catch (error) {
           console.warn(`⚠️ Provider attempt ${attempt + 1} failed:`, error.message);
           lastError = error;

           // If this is the last attempt, continue to fallback
           if (attempt === maxRetries - 1) {
             console.error(`❌ All provider attempts failed, trying fallback to opencode`);
           }
         }
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
           // Pipe the ReadableStream to the response
           await response.body.pipeTo(new WritableStream({
             write(chunk) {
               res.write(chunk);
             },
             close() {
               res.end();
             },
             abort(err) {
               console.error('Stream aborted:', err);
               res.end();
             }
           }));
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

  const port = process.env.PORT || 3010;
  app.listen(port, () => console.log(`OpenAI-like wrapper running on port ${port}`));
}

start();