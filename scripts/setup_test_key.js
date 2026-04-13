import { WrapperKey } from '../db/mongo.js';
import { initDB } from '../db/index.js';
import { createHash } from 'crypto';

(async () => {
    try {
        await initDB();
        const apiKey = 'sk-antigravity-test';
        const hash = createHash('sha256').update(apiKey).digest('hex');
        const prefix = apiKey.substring(0, 10) + '...';
        
        // Remove if exists
        await WrapperKey.deleteOne({ name: 'antigravity-test' });
        
        const newKey = new WrapperKey({
            name: 'antigravity-test',
            api_key_hash: hash,
            prefix: prefix,
            is_active: true
        });

        await newKey.save();
        console.log('✅ Successfully created/reset test key in MongoDB: sk-antigravity-test');
    } catch (err) {
        console.error('❌ Error setup test key:', err.message);
    } finally {
        process.exit();
    }
})();
