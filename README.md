# OpenCode Wrapper

An OpenAI-compatible API wrapper that uses **OpenCode Zen's FREE models** - no API keys required beyond Zen signup!

## Features

- OpenAI-compatible chat completions API
- Uses **free models** from OpenCode Zen (Grok Code, Code Supernova)
- **Free to use** - only requires Zen account signup
- Dynamic model selection
- **Image processing** - supports images via base64 embedding in text prompts
- Swagger documentation
- Environment-based configuration

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env` and configure your settings:
   ```bash
   cp .env .env.local
   ```

   Edit `.env.local` with your configuration.

## Setup

### 1. Get Your Free Zen API Key

1. Visit [OpenCode Zen](https://opencode.ai/auth)
2. Sign up for a free account
3. Go to API Keys section and create a new key
4. Copy your API key

### 2. Configuration

Create a `.env` file with your Zen settings:

```env
# OpenCode Zen Configuration (FREE!)
ZEN_BASE_URL=https://opencode.ai/zen/v1
ZEN_API_KEY=your-zen-api-key-here

# Default Model Configuration (Free Zen models)
DEFAULT_MODEL=grok-code

# API Configuration
PORT=3010

# Development Mode (disable rate limiting for development)
DEV_MODE=false

# Rate Limiting (only applies when DEV_MODE=false)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Start the Wrapper

```bash
npm install
npm start
```

**For development** (no rate limits):
```bash
DEV_MODE=true npm start
```

**That's it!** Access to free AI models with just a Zen signup.

### 🆓 Free Models Available

- **Grok Code** (`grok-code`) - Free coding assistant with image analysis
- **Code Supernova** (`code-supernova`) - Free stealth model

## Usage

1. **Start your local AI model** (Ollama/LM Studio)
2. **Start the wrapper**:
   ```bash
   npm start
   ```
3. **Make API calls** - no authentication needed!

## API Endpoints

### POST /v1/chat/completions

Create a chat completion using OpenCode Zen models.

**Request Body (Text):**
```json
{
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "model": "grok-code"
}
```

**Request Body (With Image):**
```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What is in this image?"},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}
      ]
    }
  ],
  "model": "grok-code"
}
```

**Response:**
```json
{
  "id": "chatcmpl-1234567890",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "grok-code",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### GET /v1/models

List available models.

## Image Processing

This wrapper supports image analysis by embedding base64-encoded images directly in the text prompt. Simply include `image_url` objects in the message content array, and the system will convert them to text for processing.

- **Supported formats:** Base64 data URLs (e.g., `data:image/png;base64,...`)
- **How it works:** Images are decoded and described by the AI model
- **Example:** A 1x1 transparent PNG is described as "a minimal 1x1 pixel PNG file with a single transparent pixel"

## Development

2. For development with auto-restart:
   ```bash
   npm run dev
   ```

3. View API documentation at `http://localhost:3010/api-docs`

## Authentication & Usage

To use the API, you must include a valid **Client API Key** in the `Authorization` header. You can generate these keys in the **Admin Panel > Client Keys**.

**Format:**
```
Authorization: Bearer sk-your_generated_client_key
```

### Example Requests

#### 1. curl (Terminal)
```bash
curl -X POST http://localhost:3010/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your_generated_client_key" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "model": "gpt-3.5-turbo"
  }'
```

#### 2. Python (openai library)
You can use the standard OpenAI Python library by changing the `base_url` and `api_key`.

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3010/v1",
    api_key="sk-your_generated_client_key"
)

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "Tell me a joke."}
    ]
)

print(response.choices[0].message.content)
```

#### 3. Python (requests)
```python
import requests

url = "http://localhost:3010/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk-your_generated_client_key"
}
data = {
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
}

response = requests.post(url, headers=headers, json=data)
print(response.json())
```

## Requirements

- Node.js 18+
- Free OpenCode Zen account ([sign up here](https://opencode.ai/auth))
- Zen API key configured in `.env`

## Development Mode

**Disable rate limiting** during development:

```bash
# Option 1: Environment variable
DEV_MODE=true npm start

# Option 2: Edit .env file
DEV_MODE=true
```

**Benefits:**
- Unlimited API calls for testing
- No rate limit errors during development
- Rate limiting automatically active in production

**Default:** Rate limiting is enabled (100 requests per 15 minutes)