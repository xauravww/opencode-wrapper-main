import Database from 'better-sqlite3';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User, ProviderKey, WrapperKey, RequestLog, ProviderStats, ModelPricing } from '../db/mongo.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQLITE_PATH = path.resolve(__dirname, '../db/opencode.db');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/opencode_wrapper';

async function migrate() {
    console.log('🚀 Starting migration to MongoDB...');
    
    const sqlite = new Database(SQLITE_PATH);
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Admin Users
    console.log('👤 Migrating Users...');
    const users = sqlite.prepare('SELECT * FROM admin_users').all();
    for (const u of users) {
        await User.findOneAndUpdate(
            { username: u.username },
            { 
                sqlite_id: u.id,
                password_hash: u.password_hash,
                created_at: new Date(u.created_at)
            },
            { upsert: true }
        );
    }
    console.log(`✅ Migrated ${users.length} users`);

    // 2. Provider Keys
    console.log('🔑 Migrating Provider Keys...');
    const pKeys = sqlite.prepare('SELECT * FROM provider_keys').all();
    for (const k of pKeys) {
        await ProviderKey.findOneAndUpdate(
            { provider_name: k.provider_name, api_key: k.api_key },
            {
                sqlite_id: k.id,
                is_active: !!k.is_active,
                added_at: new Date(k.added_at)
            },
            { upsert: true }
        );
    }
    console.log(`✅ Migrated ${pKeys.length} provider keys`);

    // 3. Wrapper Keys
    console.log('🛡️ Migrating Wrapper Keys...');
    const wKeys = sqlite.prepare('SELECT * FROM wrapper_keys').all();
    const wrapperKeyMap = new Map(); // sqlite_id -> mongo_id
    for (const k of wKeys) {
        const doc = await WrapperKey.findOneAndUpdate(
            { api_key_hash: k.api_key_hash },
            {
                sqlite_id: k.id,
                name: k.name,
                prefix: k.prefix,
                is_active: !!k.is_active,
                created_at: new Date(k.created_at)
            },
            { upsert: true, new: true }
        );
        wrapperKeyMap.set(k.id, doc._id);
    }
    console.log(`✅ Migrated ${wKeys.length} wrapper keys`);

    // 4. Model Pricing
    console.log('💰 Migrating Model Pricing...');
    const pricing = sqlite.prepare('SELECT * FROM model_pricing').all();
    for (const p of pricing) {
        await ModelPricing.findOneAndUpdate(
            { provider: p.provider, model: p.model },
            {
                sqlite_id: p.id,
                input_cost_per_1m: p.input_cost_per_1m,
                output_cost_per_1m: p.output_cost_per_1m,
                updated_at: new Date(p.updated_at)
            },
            { upsert: true }
        );
    }
    console.log(`✅ Migrated ${pricing.length} pricing records`);

    // 5. Provider Stats
    console.log('📊 Migrating Provider Stats...');
    const stats = sqlite.prepare('SELECT * FROM provider_stats').all();
    for (const s of stats) {
        let responseTimes = [];
        try {
            responseTimes = s.response_times_json ? JSON.parse(s.response_times_json) : [];
        } catch (e) {}

        await ProviderStats.findOneAndUpdate(
            { provider_name: s.provider_name },
            {
                priority: s.priority,
                speed_score: s.speed_score,
                error_rate: s.error_rate,
                total_requests: s.total_requests,
                successful_requests: s.successful_requests,
                avg_response_time: s.avg_response_time,
                health_status: s.health_status,
                last_updated: new Date(s.last_updated),
                response_times: responseTimes
            },
            { upsert: true }
        );
    }
    console.log(`✅ Migrated ${stats.length} provider stats`);

    // 6. Request Logs
    console.log('📝 Migrating Request Logs (this may take a while)...');
    const logs = sqlite.prepare('SELECT * FROM request_logs').all();
    const logBatch = [];
    for (const l of logs) {
        logBatch.push({
            wrapper_key_id: wrapperKeyMap.get(l.wrapper_key_id),
            wrapper_key_sqlite_id: l.wrapper_key_id,
            provider: l.provider,
            model: l.model,
            prompt_tokens: l.prompt_tokens,
            completion_tokens: l.completion_tokens,
            latency_ms: l.latency_ms,
            status_code: l.status_code,
            timestamp: new Date(l.timestamp),
            cost_usd: l.cost_usd
        });
        
        if (logBatch.length >= 500) {
            await RequestLog.insertMany(logBatch);
            logBatch.length = 0;
        }
    }
    if (logBatch.length > 0) {
        await RequestLog.insertMany(logBatch);
    }
    console.log(`✅ Migrated ${logs.length} request logs`);

    console.log('\n✨ Migration Complete! ✨');
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ Migration Failed:', err);
    process.exit(1);
});
