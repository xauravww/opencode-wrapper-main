import { RequestLog } from '../db/mongo.js';
import { initDB } from '../db/index.js';

(async () => {
    try {
        await initDB();
        
        const logs = await RequestLog.find({ completion_tokens: { $gt: 0 } })
            .sort({ timestamp: -1 })
            .limit(5);

        if (logs.length > 0) {
            console.log('✅ Latest 5 Successful Log Entries (Tokens > 0) from MongoDB:');
            console.log(JSON.stringify(logs, null, 2));
        } else {
            console.log('❌ No logs found in MongoDB.');
        }
    } catch (err) {
        console.error('❌ Error checking logs:', err.message);
    } finally {
        process.exit();
    }
})();
