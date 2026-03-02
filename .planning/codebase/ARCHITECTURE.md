# Architecture

**Analysis Date:** 2026-03-02

## Pattern Overview

**Overall:** Multi-Provider API Gateway with OpenAI-Compatible REST Interface

**Key Characteristics:**
- Express.js server exposing OpenAI-compatible endpoints (`/v1/chat/completions`, `/v1/models`, etc.)
- ProviderManager class managing 12+ LLM providers with dynamic key loading and health monitoring
- SQLite database for persistent storage of logs, keys, and provider statistics
- React admin dashboard for monitoring and key management
- Dual authentication: JWT for admin routes, API keys for client access

## Layers

**API Layer (Express Routes):**
- Location: `server.js` (lines 330-1463)
- Contains: All REST endpoint handlers
- Depends on: ProviderManager, db module, utility modules
- Used by: External clients, admin dashboard

**Provider Abstraction Layer:**
- Location: `providerManager.js`
- Contains: ProviderManager class with provider configs, health checks, request routing
- Depends on: db module, environment variables
- Used by: API layer for making LLM requests

**Database Layer:**
- Location: `db/index.js`, `db/schema.sql`
- Contains: SQLite database initialization and query interface
- Depends on: better-sqlite3
- Used by: All layers needing persistence

**Utility Layer:**
- Location: `utils/`
- Contains: Stream tracking, email services
- Depends on: Various npm packages (nodemailer, xlsx, stream)
- Used by: Server.js for specific features

**Frontend Layer:**
- Location: `client/`
- Contains: React admin dashboard
- Depends on: Vite, React, Tailwind CSS, React Router
- Used by: Administrators for monitoring and management

## Data Flow

**Chat Completion Flow:**

1. Client sends POST to `/v1/chat/completions` with messages and model
2. `verifyWrapperKey` middleware authenticates the API key from `wrapper_keys` table
3. ProviderManager.getOrderedProviders() returns providers sorted by priority/speed
4. Loop through top 3 providers, attempting each until success
5. For each provider: makeRequest() fetches from provider API with auth headers
6. Response logged to `request_logs` table with cost calculation
7. If all providers fail, fallback to OpenCode Zen API
8. If streaming: use `trackStreamAndLog` to pipe SSE response while parsing tokens

**Provider Health Monitoring:**

1. ProviderManager.startHealthChecks() runs every 30 seconds
2. Makes test requests to `/models` endpoint for each configured provider
3. Updates stats in memory and persists to `provider_stats` table every 5 seconds
4. Error rate and response time affect provider priority calculation

**Admin Authentication Flow:**

1. POST to `/api/auth/login` with username/password
2. bcrypt compares password hash from `admin_users` table
3. JWT token issued with 24h expiry
4. Subsequent admin requests include JWT in `x-access-token` header

## Key Abstractions

**ProviderManager:**
- Purpose: Abstracts multiple LLM providers behind single interface
- Location: `providerManager.js`
- Pattern: Singleton-like class with provider configs, health stats, request routing
- Key methods: `makeRequest()`, `getOrderedProviders()`, `reloadKeys()`, `getProviderStatus()`

**Database Module:**
- Purpose: SQLite connection and query interface
- Location: `db/index.js`
- Pattern: Default export of initialized better-sqlite3 instance

**Stream Tracker:**
- Purpose: Parse SSE streams for token usage while piping to client
- Location: `utils/streamTracker.js`
- Pattern: Node.js Transform stream that passes through data while parsing

## Entry Points

**Main Server:**
- Location: `server.js`
- Triggers: `node server.js` or `npm start`
- Responsibilities: Express app initialization, all route handlers, middleware setup, cron jobs

**Database Initialization:**
- Location: `db/index.js` - `initDB()` function
- Triggers: Called from server.js start() function
- Responsibilities: Create tables from schema.sql, create default admin user

**Client Build:**
- Location: `client/vite.config.js`
- Triggers: `npm run build` in client directory
- Responsibilities: Build React app for production

## Error Handling

**Strategy:** Try-catch blocks with provider fallback

**Patterns:**
- Try multiple providers in order, continue on failure
- Auth errors (401/402/403) mark provider as unhealthy
- Timeout errors (15s) trigger provider failure
- All errors logged to console and database
- Final fallback to OpenCode Zen if all providers fail

## Cross-Cutting Concerns

**Logging:** Morgan middleware for HTTP logging + console.log for application logs

**Validation:** Basic validation in route handlers, no formal schema validation

**Authentication:** 
- JWT for admin endpoints (verifyToken middleware)
- API key hashing with SHA-256 for client keys (verifyWrapperKey middleware)
- Keys stored as hash in database

**Rate Limiting:** Express-rate-limit middleware (configurable via environment)

---

*Architecture analysis: 2026-03-02*
