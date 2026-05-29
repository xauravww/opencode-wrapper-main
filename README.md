# OpenCode Wrapper

An enterprise-grade, high-performance API gateway and wrapper that provides an OpenAI-compatible interface across multiple LLM providers (Groq, Anthropic, Gemini, OpenAI, Cerebras, etc.) with smart fallback, load balancing, and rate limiting.

## Core Features

- **OpenAI-Compatible Interface**: Seamlessly drop-in replacement for OpenAI endpoints (`/v1/chat/completions`).
- **Multi-Provider Load Balancing**: Automatically routes requests to the fastest and healthiest provider based on historical latency and error rates.
- **Smart Fallback**: If a primary provider (like Groq) fails or times out, the request is instantly re-routed to the next best provider without the client noticing.
- **Free Default Models**: Out-of-the-box support for OpenCode Zen's free models as a reliable fallback.
- **Image Generation & Text-to-Speech**: Built-in support for `/v1/images/generations` and `/v1/audio/speech`.
- **Admin & Client API Keys**: Secure your endpoints using MongoDB-backed Client API keys. Generate keys instantly via the Admin API.
- **Analytics & Billing**: Tracks tokens, latency, and cost per request.

## Architecture Highlights
- **Fail Fast**: Configured with strict 10s timeouts to prevent connection hanging.
- **In-Memory LRU Auth**: API keys are cached in memory (5m TTL) to eliminate database bottlenecks on the hot path.
- **Async Logging**: High-throughput analytics queue batches logs to MongoDB without blocking API responses.

## Installation & Setup

1. **Clone & Install**
   ```bash
   git clone https://github.com/yourusername/opencode-wrapper.git
   cd opencode-wrapper
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to add your Provider API keys (Groq, Gemini, Anthropic, etc.) and your MongoDB connection string.

3. **Start the Gateway**
   ```bash
   npm start
   ```
   *For development (disables rate limiting):*
   ```bash
   DEV_MODE=true npm start
   ```

## Usage (Authentication)

To use the API, you must authenticate using a **Client API Key**. You can generate these in your database or via the Admin interface.

```bash
curl -X POST http://localhost:3010/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your_generated_client_key" \
  -d '{
    "messages": [
      {"role": "user", "content": "Explain quantum computing in one sentence."}
    ],
    "model": "llama-3.3-70b",
    "stream": true
  }'
```

### Python OpenAI SDK
Because this is an OpenAI-compatible gateway, you can simply use the standard `openai` Python/Node SDKs:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3010/v1",
    api_key="sk-your_generated_client_key"
)

response = client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## Scaling Considerations

If you plan to run multiple instances behind a load balancer, note the following:
- Ensure MongoDB is accessible to all instances.
- Enable the Redis configuration in your `.env` to share image caching and distributed rate limiting (Recommended for production).