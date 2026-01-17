
import { Transform } from 'stream';

/**
 * Pipes a provider's SSE response to the client response (res),
 * while parsing the stream for token usage data.
 * Logs the request details to the database once the stream ends.
 * 
 * @param {Object} response - The provider's response object (node-fetch/Response).
 * @param {Object} res - The Express response object to pipe to.
 * @param {Object} db - The database instance.
 * @param {Object} logData - Object containing metadata for logging (wrapperKeyId, provider, model, ip, startTime).
 */
export function trackStreamAndLog(response, res, db, logData) {
    let usage = { prompt_tokens: 0, completion_tokens: 0 };
    let responseContentLength = 0;
    let buffer = '';

    const transformer = new Transform({
        transform(chunk, encoding, callback) {
            // 1. Pass through to client immediately
            this.push(chunk);

            // 2. Accumulate for parsing
            responseContentLength += chunk.length;
            buffer += chunk.toString();

            // Process complete SSE lines
            const lines = buffer.split('\n');
            // Keep the last partial line in the buffer
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const content = line.slice(6).trim();
                    if (content === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(content);
                        // Capture usage if present
                        if (parsed.usage) {
                            usage = parsed.usage;
                        }
                    } catch (e) {
                        // Ignore parse errors (partial JSON or other data)
                    }
                }
            }
            callback();
        }
    });

    // Handle stream completion
    transformer.on('end', () => {
        // Write log to DB
        try {
            const { wrapperKeyId, provider, model, startTime, ip } = logData;

            // Calculate Cost
            // Pricing Defaults (USD per 1M tokens) - Copied from server.js for consistency or pass it in?
            // Better to duplicate simple map or pass pricing map. We'll use a simple map here or pass cost function.
            // For now, let's just use the server.js pricing logic style or simple values.

            const PRICING = {
                'openai': { input: 2.50, output: 10.00 },
                'anthropic': { input: 3.00, output: 15.00 },
                'google': { input: 0.35, output: 1.05 },
                'mistral': { input: 2.00, output: 6.00 },
                'groq': { input: 0.59, output: 0.79 },
                'cerebras': { input: 0.00, output: 0.00 },
                'together': { input: 0.20, output: 0.20 },
                'deepseek': { input: 0.14, output: 0.28 },
                'nvidia': { input: 0.65, output: 2.20 },
                'opencode': { input: 0.50, output: 1.50 }, // fallback default
                'default': { input: 0.50, output: 1.50 }
            };

            const pricing = PRICING[provider] || PRICING['default'];
            // Ensure tokens are numbers
            const pTokens = usage.prompt_tokens || 0;
            const cTokens = usage.completion_tokens || 0;

            const inputCost = (pTokens / 1000000) * pricing.input;
            const outputCost = (cTokens / 1000000) * pricing.output;
            const finalCost = inputCost + outputCost;

            // Make sure we log something even if tokens are 0, to show success
            // But logging 0/0 is the current problem.
            // If we failed to parse usage, we log 0/0.

            db.prepare(`
        INSERT INTO request_logs (wrapper_key_id, provider, model, prompt_tokens, completion_tokens, latency_ms, status_code, cost_usd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                wrapperKeyId,
                provider,
                model,
                pTokens,
                cTokens,
                Date.now() - startTime,
                200,
                finalCost
            );

            console.log(`✅ Streamed response logged for ${provider}: ${pTokens}/${cTokens} tokens.`);
        } catch (err) {
            console.error('❌ Failed to log streamed request:', err);
        }
    });

    // Pipeline: Provider Response -> Transformer -> Client Response
    response.body.pipe(transformer).pipe(res);

    // Handle errors
    response.body.on('error', (err) => {
        console.error('Stream body error:', err);
        res.end();
    });
}
