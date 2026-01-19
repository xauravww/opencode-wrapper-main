CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wrapper_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wrapper_key_id INTEGER,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER,
  status_code INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  cost_usd REAL DEFAULT 0.0,
  FOREIGN KEY (wrapper_key_id) REFERENCES wrapper_keys(id)
);

CREATE TABLE IF NOT EXISTS provider_stats (
  provider_name TEXT PRIMARY KEY,
  priority INTEGER DEFAULT 50,
  speed_score REAL DEFAULT 50,
  error_rate REAL DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  avg_response_time REAL DEFAULT 1000,
  health_status TEXT DEFAULT 'healthy',
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  response_times_json TEXT
);

CREATE TABLE IF NOT EXISTS model_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_cost_per_1m REAL NOT NULL,
  output_cost_per_1m REAL NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, model)
);
