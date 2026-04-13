import { ProviderStats, RequestLog } from '../db/mongo.js';
import { initDB } from '../db/index.js';

const defaultProviders = [
  'groq', 'nvidia', 'gemini', 'openrouter', 'together',
  'fireworks', 'cerebras', 'anthropic', 'deepseek',
  'mistral', 'cohere', 'opencode'
];

(async () => {
    try {
        await initDB();
        console.log('Completely clearing provider stats and logs...');

        // Clear existing docs
        const statsResult = await ProviderStats.deleteMany({});
        console.log(`Deleted ${statsResult.deletedCount} provider stat records.`);

        const logsResult = await RequestLog.deleteMany({});
        console.log(`Deleted ${logsResult.deletedCount} request log records.`);

        // Recreate defaults
        const ops = defaultProviders.map(name => ({
            provider_name: name,
            priority: 50,
            speed_score: 50,
            error_rate: 0,
            total_requests: 0,
            successful_requests: 0,
            avg_response_time: 1000,
            health_status: 'healthy',
            response_times: [],
            last_updated: new Date()
        }));

        await ProviderStats.insertMany(ops);
        console.log(`✅ Recreated ${defaultProviders.length} provider stats with default values in MongoDB.`);

    } catch (err) {
        console.error('❌ Error clearing stats:', err.message);
    } finally {
        process.exit();
    }
})();