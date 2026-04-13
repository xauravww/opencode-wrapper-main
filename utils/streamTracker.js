import { Transform } from 'stream';
import { RequestLog } from '../db/mongo.js';
import { calculateCost } from './pricing.js';

/**
 * Pipes a provider's SSE response to the client response (res),
 * while parsing the stream for token usage data.
 * Logs the request details to MongoDB once the stream ends.
 * 
 * @param {Object} response - The provider's response object (node-fetch/Response).
 * @param {Object} res - The Express response object to pipe to.
 * @param {Object} logData - Object containing metadata for logging (wrapperKeyId, provider, model, ip, startTime).
 */
export function trackStreamAndLog(response, res, logData) {
    let usage = { prompt_tokens: 0, completion_tokens: 0 };
    let buffer = '';

    const transformer = new Transform({
        transform(chunk, encoding, callback) {
            // 1. Pass through to client immediately
            this.push(chunk);

            // 2. Accumulate for parsing
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
    transformer.on('end', async () => {
        // Write log to MongoDB
        try {
            const { wrapperKeyId, provider, model, startTime } = logData;

            const pTokens = usage.prompt_tokens || 0;
            const cTokens = usage.completion_tokens || 0;
            const finalCost = await calculateCost(usage, provider, model);

            await new RequestLog({
                wrapper_key_id: wrapperKeyId,
                provider,
                model,
                prompt_tokens: pTokens,
                completion_tokens: cTokens,
                latency_ms: Date.now() - startTime,
                status_code: 200,
                cost_usd: finalCost
            }).save();

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
