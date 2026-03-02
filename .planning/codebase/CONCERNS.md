# Codebase Concerns

**Analysis Date:** 2026-03-02

## Tech Debt

**Hardcoded Pricing Constants:**
- Issue: Pricing constants (USD per 1M tokens) are duplicated in `server.js` (lines 992-1003), `streamTracker.js` (lines 64-76), and `providerManager.js` (lines 451-456)
- Files: `server.js`, `utils/streamTracker.js`, `providerManager.js`
- Impact: Inconsistencies between pricing calculations, maintenance burden
- Fix approach: Create a centralized pricing module that all components import

**Debug File Writing in Production:**
- Issue: Code writes debug files (`debug_usage.json`, `debug_error.json`) to disk on every request
- Files: `server.js` (lines 983-987, 1034-1038)
- Impact: Disk I/O overhead, potential file system issues under load, information leakage
- Fix approach: Remove debug write operations or wrap in development-only conditionals

**Rate Limiting Disabled:**
- Issue: Rate limiting is commented out (lines 136-139 in `server.js`)
- Files: `server.js`
- Impact: No protection against abuse or DDoS attacks
- Fix approach: Enable rate limiting for production or make it configurable

**Default Insecure Secrets:**
- Issue: Fallback secrets are hardcoded in source code (`JWT_SECRET = 'your-secret-key'`, `API_KEY = 'your-api-key-here'`)
- Files: `server.js` (lines 146, 183)
- Impact: If env vars are not set, system runs with known-insecure defaults
- Fix approach: Fail startup if secrets are not configured in production mode

**Hardcoded Fallback Models:**
- Issue: Default model names are hardcoded as fallbacks
- Files: `server.js` (lines 861, 1063)
- Impact: Changes require code modifications
- Fix approach: Use environment variables for defaults

---

## Known Bugs

**Stream Token Usage May Be Zero:**
- Symptoms: `request_logs` shows 0/0 tokens for streaming requests
- Files: `utils/streamTracker.js`
- Trigger: Streaming responses where usage data is only in final chunk but buffer parsing may miss it
- Workaround: Check final chunk for `usage` field more robustly

**Vision Model Detection Relies on String Matching:**
- Symptoms: Non-vision providers selected for vision requests
- Files: `providerManager.js` (line 368)
- Trigger: Model names not containing expected keywords
- Workaround: Maintain explicit vision-capable model list per provider

**Provider Health Check Errors Silently Swallowed:**
- Symptoms: Provider shows as healthy even when failing
- Files: `providerManager.js` (lines 536-538)
- Trigger: Health check errors are caught but not logged
- Workaround: Log health check failures

---

## Security Considerations

**Missing Input Validation:**
- Risk: No validation on `model` parameter, `messages` content, or API key formats
- Files: `server.js` (POST `/v1/chat/completions`)
- Current mitigation: None
- Recommendations: Add schema validation for all request bodies

**SQL Injection Risk in Admin Logs Endpoint:**
- Risk: `req.query.provider` and `req.query.status` are directly interpolated into SQL (lines 521-522)
- Files: `server.js`
- Current mitigation: None visible
- Recommendations: Use parameterized queries for filters

**API Key Hash Timing Attack:**
- Risk: Using direct string comparison for API keys before hashing
- Files: `server.js` (line 156)
- Current mitigation: None
- Recommendations: Use constant-time comparison

**CORS Allows All Origins by Default:**
- Risk: If `ALLOWED_ORIGINS` env is not set, all origins are allowed
- Files: `server.js` (line 38)
- Current mitigation: None
- Recommendations: Require explicit origin configuration in production

**Admin Endpoints Not Rate Limited:**
- Risk: Brute force attacks on admin routes
- Files: `server.js` (all `/api/admin/*` routes)
- Current mitigation: Only global rate limiting which is disabled
- Recommendations: Enable rate limiting specifically for admin endpoints

---

## Performance Bottlenecks

**Image Cache Unbounded Memory Usage:**
- Problem: Full image data stored in memory with 1-hour expiration but no size limit
- Files: `server.js` (lines 120, 315-327)
- Cause: No eviction based on memory pressure
- Improvement path: Add maximum cache size with LRU eviction

**Database Grows Unbounded:**
- Problem: `request_logs` table grows without limit; 30-day cleanup runs but backs up logs via email first
- Files: `server.js` (lines 262-299)
- Cause: Email backup is a bottleneck; logs accumulate if email fails
- Improvement path: Implement direct database archiving or increase cleanup frequency

**All Provider Health Checks Run Simultaneously:**
- Problem: Batch of 3 health checks run in parallel but next batch waits
- Files: `providerManager.js` (lines 521-540)
- Cause: Sequential batch processing
- Improvement path: Run all health checks concurrently with concurrency limit

**Synchronous File Writes in Request Path:**
- Problem: `debug_usage.json` and `debug_error.json` writes block request handling
- Files: `server.js`
- Cause: Synchronous `fs.writeFileSync` in request handler
- Improvement path: Remove debug writes or make async

---

## Fragile Areas

**Provider Selection Algorithm:**
- Files: `providerManager.js` (lines 279-327)
- Why fragile: Complex priority calculation with many factors (speed, errors, health); hard to predict behavior
- Safe modification: Add logging to trace provider selection decisions
- Test coverage: No unit tests for priority calculation

**MCP Tool Execution:**
- Files: `server.js` (lines 92-118)
- Why fragile: Hardcoded server configurations, no validation, spawns processes
- Safe modification: Validate tool names against allowlist, add timeouts
- Test coverage: No tests

**Stream Response Handling:**
- Files: `utils/streamTracker.js`
- Why fragile: Complex stream transformation, error handling may fail silently
- Safe modification: Add comprehensive error handling and logging
- Test coverage: No tests

---

## Scaling Limits

**SQLite Database:**
- Current capacity: Suitable for small to medium workloads (< 100k requests/day)
- Limit: Single-writer lock, limited concurrent connections
- Scaling path: Migrate to PostgreSQL or implement read replicas

**In-Memory Image Cache:**
- Current capacity: Limited by available RAM
- Limit: Large images or high volume will cause OOM
- Scaling path: Use Redis or file-based cache with CDN

**Express Server (Single Instance):**
- Current capacity: Depends on CPU/memory of host
- Limit: Single-threaded event loop bottleneck
- Scaling path: Use cluster mode or migrate to worker threads

---

## Dependencies at Risk

**@rohitaryal/whisk-api:**
- Risk: Relatively unknown package, limited community support
- Impact: Image generation feature breaks if package is abandoned
- Migration plan: Implement alternative image generation API (e.g., DALL-E, Stability AI)

**edge-tts-universal:**
- Risk: Custom wrapper around Microsoft Edge TTS
- Impact: TTS feature breaks if Microsoft changes TTS API
- Migration plan: Use official Azure Speech SDK or alternative TTS provider

**better-sqlite3:**
- Risk: Native module requires compilation, may fail on some platforms
- Impact: Database operations fail if native bindings don't compile
- Migration plan: Use sql.js (pure JavaScript SQLite) or migrate to PostgreSQL

---

## Missing Critical Features

**Request Timeout Configuration:**
- Problem: Hardcoded 15-second timeout in `providerManager.js` (line 407)
- Blocks: Custom timeout per request or provider

**Proper Error Responses:**
- Problem: Some errors return generic 500 with limited details
- Blocks: Client-side error handling and user feedback

**Request Idempotency:**
- Problem: No idempotency keys for duplicate request protection
- Blocks: Safe retry logic for clients

---

## Test Coverage Gaps

**ProviderManager Class:**
- What's not tested: Priority calculation, failover logic, health check behavior
- Files: `providerManager.js`
- Risk: Changes to provider selection may cause unexpected behavior
- Priority: High

**Server API Endpoints:**
- What's not tested: All REST endpoints, especially `/v1/chat/completions`
- Files: `server.js`
- Risk: Breaking changes go undetected
- Priority: High

**Stream Handling:**
- What's not tested: SSE parsing, token extraction, error recovery
- Files: `utils/streamTracker.js`
- Risk: Streaming breaks under edge cases
- Priority: Medium

**Failover Logic:**
- What's not tested: Provider fallback when primary fails
- Files: `server.js` (lines 903-1047)
- Risk: Users experience downtime when providers fail
- Priority: High

---

*Concerns audit: 2026-03-02*
