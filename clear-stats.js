import db from './db/index.js';

console.log('Completely clearing provider stats...');

// Delete all existing provider stats
const deleteStmt = db.prepare('DELETE FROM provider_stats');
const deleteResult = deleteStmt.run();
console.log(`Deleted ${deleteResult.changes} provider stat records.`);

// Now recreate with default values for common providers
const defaultProviders = [
  'groq', 'nvidia', 'gemini', 'openrouter', 'together',
  'fireworks', 'cerebras', 'anthropic', 'deepseek',
  'mistral', 'cohere', 'opencode'
];

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO provider_stats
  (provider_name, priority, speed_score, error_rate, total_requests, successful_requests, avg_response_time, health_status, response_times_json)
  VALUES (?, 50, 50, 0, 0, 0, 1000, 'healthy', '[]')
`);

for (const provider of defaultProviders) {
  insertStmt.run(provider);
}

console.log(`Recreated ${defaultProviders.length} provider stats with default values.`);

console.log('Provider stats completely cleared and reset!');