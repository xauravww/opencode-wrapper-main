# External Integrations

**Analysis Date:** 2026-03-02

## APIs & External Services

### AI/LLM Providers

**Primary/Fallback:**
- OpenCode AI (Zen) - `ZEN_API_KEY`
  - Base URL: `https://opencode.ai/zen/v1`
  - Models: minimax-m2.1-free, grok-code
  - Used as final fallback provider

**Supported Providers (via environment variables):**
| Provider | Env Variable | Base URL | Key Suffix |
|----------|--------------|----------|------------|
| Groq | `GROQ_API_KEYS` | `https://api.groq.com/openai/v1` | comma-separated |
| NVIDIA | `NVIDIA_API_KEYS` | `https://integrate.api.nvidia.com/v1` | comma-separated |
| Google Gemini | `GEMINI_API_KEYS` | `https://generativelanguage.googleapis.com` | comma-separated |
| OpenRouter | `OPENROUTER_API_KEYS` | `https://openrouter.ai/api/v1` | comma-separated |
| Together AI | `TOGETHER_API_KEYS` | `https://api.together.xyz/v1` | comma-separated |
| Fireworks AI | `FIREWORKS_API_KEYS` | `https://api.fireworks.ai/inference/v1` | comma-separated |
| Cerebras | `CEREBRAS_API_KEYS` | `https://api.cerebras.ai/v1` | comma-separated |
| Anthropic | `ANTHROPIC_API_KEYS` | `https://api.anthropic.com/v1` | comma-separated |
| DeepSeek | `DEEPSEEK_API_KEYS` | `https://api.deepseek.com/v1` | comma-separated |
| Mistral | `MISTRAL_API_KEYS` | `https://api.mistral.ai/v1` | comma-separated |
| Cohere | `COHERE_API_KEYS` | `https://api.cohere.ai/v1` | comma-separated |

### MCP Servers (Model Context Protocol)

- **SearXNG** - Web search via `mcp-searxng`
  - URL: `http://localhost:10000` (configurable via `SEARXNG_URL`)
  - Tools: `searxng_web_search`

- **Sequential Thinking** - `@modelcontextprotocol/server-sequential-thinking`
  - Tools: `sequentialthinking`

- **Puppeteer** - Browser automation `@modelcontextprotocol/server-puppeteer`
  - Cache: `/home/saurav/.cache/puppeteer`
  - Tools: `puppeteer_fill`, `puppeteer_evaluate`

### Whisk API

- **Whisk (Recipe API)** - `@rohitaryal/whisk-api` 3.1.0
  - Used for recipe-related functionality

### Text-to-Speech

- **Edge TTS Universal** - `edge-tts-universal` 1.3.3
  - Microsoft Edge TTS integration for voice synthesis

## Data Storage

**Database:**
- SQLite (via `better-sqlite3`)
  - Connection: Local file `db/opencode.db`
  - Tables: admin_users, provider_keys, wrapper_keys, request_logs, provider_stats, model_pricing
  - Schema: `db/schema.sql`

**File Storage:**
- Local filesystem only
  - Provider stats: `./provider_stats.json`
  - Database: `./db/opencode.db`

**Caching:**
- None detected - In-memory caching via ProviderManager stats

## Authentication & Identity

**Auth Provider:**
- Custom JWT + bcryptjs implementation
  - JWT for API token authentication
  - bcryptjs for password hashing
  - Admin credentials via `ADMIN_USER` / `ADMIN_PASS`

**API Key Management:**
- Wrapper keys stored in database (`wrapper_keys` table)
- Provider API keys managed via environment variables and `provider_keys` table

## Email & Notifications

**SMTP:**
- Nodemailer 7.0.12
- Default: Gmail SMTP (`smtp.gmail.com:587`)
- Configuration via `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`
- Used for: Log backup notifications (via `utils/emailService.js`)

**Backup Email:**
- Recipient: `OWNER_MAIL`
- Format: Excel attachment (.xlsx) using `xlsx` library

## Monitoring & Observability

**Error Tracking:**
- Not detected - Console logging only

**Logs:**
- Morgan middleware - HTTP request logging
- File-based: `request_logs` table in SQLite
- Console: Standard console.log/error

## CI/CD & Deployment

**Hosting:**
- Self-hosted Node.js application
- No detected CI/CD pipeline
- No containerization (Docker)

**Deployment:**
- `npm start` - Production run
- `npm run dev` - Development with watch mode

## Environment Configuration

**Required env vars:**
```
# Core
ZEN_API_KEY           # OpenCode AI primary/fallback
PORT=3010             # Server port
ALLOWED_ORIGINS      # CORS origins (comma-separated)

# Provider Keys (comma-separated for multiple)
GROQ_API_KEYS, NVIDIA_API_KEYS, GEMINI_API_KEYS,
OPENROUTER_API_KEYS, TOGETHER_API_KEYS, FIREWORKS_API_KEYS,
CEREBRAS_API_KEYS, ANTHROPIC_API_KEYS, DEEPSEEK_API_KEYS,
MISTRAL_API_KEYS, COHERE_API_KEYS

# Email
EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, OWNER_MAIL

# Admin
ADMIN_USER, ADMIN_PASS
```

**Secrets location:**
- `.env` file (gitignored)
- Environment variables for all sensitive data

## Webhooks & Callbacks

**Incoming:**
- API endpoints exposed via Express server
- OpenAI-compatible endpoints: `/v1/chat/completions`, `/v1/completions`
- Admin endpoints: `/api/admin/*`

**Outgoing:**
- AI provider API calls (12+ providers)
- MCP server tool execution
- SMTP email delivery

---

*Integration audit: 2026-03-02*
