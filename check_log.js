import db from './db/index.js';

const logs = db.prepare('SELECT * FROM request_logs WHERE completion_tokens > 0 ORDER BY timestamp DESC LIMIT 5').all();
if (logs.length > 0) {
    console.log('✅ Latest 5 Successful Log Entries (Tokens > 0):');
    console.log(JSON.stringify(logs, null, 2));
} else {
    console.log('❌ No logs found.');
}
