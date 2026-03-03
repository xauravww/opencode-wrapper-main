# Coding Conventions

**Analysis Date:** 2026-03-02

## Language & Module System

**Primary Language:** JavaScript (ES2022+)
- Module System: ES Modules (`"type": "module"` in `package.json`)
- Runtime: Node.js

**File Extensions:**
- `.js` - JavaScript files (ES modules)
- `.jsx` - React components

## Naming Patterns

**Files:**
- camelCase: `providerManager.js`, `streamTracker.js`, `emailService.js`
- kebab-case: Utility scripts often use this pattern

**Classes:**
- PascalCase: `ProviderManager`, `Communicate` (from edge-tts)
- Example: `class ProviderManager { }` in `providerManager.js`

**Functions:**
- camelCase: `initializeProviders()`, `getBestModelForProvider()`, `trackStreamAndLog()`
- Verb-prefixed: `start()`, `executeMCPTool()`, `verifyToken()`

**Variables:**
- camelCase: `apiKey`, `providerName`, `wrapperKeyId`
- Constants: UPPER_SNAKE_CASE for config objects like `PRICING` in `utils/streamTracker.js`

**Database Tables:**
- snake_case: `request_logs`, `wrapper_keys`, `provider_keys`, `admin_users`

## Code Style

**Formatting:**
- No explicit formatter configured (no Prettier)
- 2-space indentation observed
- No semicolons at line ends (ES module style)
- Line length varies, no enforced limit

**Linting:**
- No ESLint configuration detected
- No Prettier configuration detected
- VSCode settings only contain color customizations

**Variable Declaration:**
- `const` for values that won't be reassigned
- `let` for mutable values
- No `var` usage observed

## Import Organization

**Order in `server.js`:**
1. Built-in Node.js modules: `fs`, `path`, `crypto`, `stream`
2. Third-party npm packages: `express`, `dotenv`, `bcryptjs`, `jsonwebtoken`
3. Local imports: `./providerManager.js`, `./db/index.js`, `./utils/streamTracker.js`

**Example:**
```javascript
import fs from 'fs';
import dotenv from 'dotenv';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import ProviderManager from './providerManager.js';
import { initDB } from './db/index.js';
```

## Error Handling

**Patterns Used:**

1. **Try/Catch with Logging:**
```javascript
try {
  await client.connect(transport);
  const result = await client.callTool({ name: toolName, arguments: args });
  return result;
} finally {
  await client.close();
}
```

2. **Express Error Responses:**
```javascript
return res.status(401).json({ error: 'Missing or invalid authorization header' });
```

3. **Error Logging:**
```javascript
catch (err) {
  console.error("Key verification error:", err.message);
}
```

4. **Silent Failures with Defaults:**
```javascript
const pricing = PRICING[provider] || PRICING['default'];
```

## Logging

**Framework:** `console` (native Node.js)

**Patterns:**
- Standard logs: `console.log('🚀 Starting provider tests...')`
- Warnings: `console.warn('⚠️ No owner email configured...')`
- Errors: `console.error('❌ Failed to log streamed request:', err)`
- Emoji prefixes for readability: `✅`, `❌`, `🔒`, `🧹`

**Example from `test_providers.js`:**
```javascript
console.log(`📡 URL: ${url}`);
console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
console.log(`📊 Status: ${response.status} ${response.statusText}`);
```

## Comments

**When to Comment:**
- JSDoc-style comments for utility functions: See `utils/streamTracker.js` lines 4-13
- Inline comments for complex logic: `// 1. Allow requests with no origin...`
- TODO/FIXME comments are not prominently used

**Example JSDoc:**
```javascript
/**
 * Pipes a provider's SSE response to the client response (res),
 * while parsing the stream for token usage data.
 * Logs the request details to the database once the stream ends.
 * 
 * @param {Object} response - The provider's response object
 * @param {Object} res - The Express response object
 * @param {Object} db - The database instance
 * @param {Object} logData - Object containing metadata
 */
```

## Function Design

**Size:** Functions tend to be medium-sized (10-50 lines), with some larger route handlers (100+ lines in `server.js`)

**Parameters:** 
- Named parameters preferred
- Destructuring used for options objects

**Return Values:**
- Explicit returns for early exits
- Async functions return Promises
- JSON responses via Express `res.json()`

## Module Design

**Exports:**
- Named exports for utilities: `export function trackStreamAndLog(...)`
- Default exports for main modules: `export default db;` in `db/index.js`

**Barrel Files:** Not used - imports go directly to specific modules

**Class Structure:**
```javascript
class ProviderManager {
  constructor() {
    this.providers = {};
    this.stats = { ... };
    this.initializeProviders();
  }
  
  initializeProviders() { ... }
  getOrderedProviders() { ... }
}
```

## React/Frontend Conventions

**Component Structure (`.jsx`):**
- Functional components with hooks
- Context API for state management: `createContext`, `useContext`
- Example: `AuthContext` in `client/src/App.jsx`

**Imports:**
- React imports first: `import React, { useState, useEffect } from 'react'`
- Third-party libraries: `import { BrowserRouter, Routes } from 'react-router-dom'`
- Local imports: `import api from './api';`

**API Layer:**
- Axios instance in `client/src/api.js`
- Request interceptor for auth tokens
- Response interceptor for 401 handling

---

*Convention analysis: 2026-03-02*
