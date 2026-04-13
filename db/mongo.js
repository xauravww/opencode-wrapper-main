import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  sqlite_id: Number, // Preserve for migration
  username: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const providerKeySchema = new mongoose.Schema({
  sqlite_id: Number,
  provider_name: { type: String, required: true },
  api_key: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  added_at: { type: Date, default: Date.now }
});

const wrapperKeySchema = new mongoose.Schema({
  sqlite_id: Number,
  name: { type: String, required: true },
  api_key_hash: { type: String, unique: true, required: true },
  prefix: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

const requestLogSchema = new mongoose.Schema({
  wrapper_key_id: { type: mongoose.Schema.Types.ObjectId, ref: 'WrapperKey' },
  wrapper_key_sqlite_id: Number, // Use during migration to map
  provider: { type: String, required: true },
  model: { type: String, required: true },
  prompt_tokens: { type: Number, default: 0 },
  completion_tokens: { type: Number, default: 0 },
  latency_ms: Number,
  status_code: Number,
  timestamp: { type: Date, default: Date.now },
  cost_usd: { type: Number, default: 0 }
});

const providerStatsSchema = new mongoose.Schema({
  provider_name: { type: String, unique: true, required: true },
  priority: { type: Number, default: 50 },
  speed_score: { type: Number, default: 50 },
  error_rate: { type: Number, default: 0 },
  total_requests: { type: Number, default: 0 },
  successful_requests: { type: Number, default: 0 },
  avg_response_time: { type: Number, default: 1000 },
  health_status: { type: String, default: 'healthy' },
  last_updated: { type: Date, default: Date.now },
  response_times: [Number]
});

const modelPricingSchema = new mongoose.Schema({
  sqlite_id: Number,
  provider: { type: String, required: true },
  model: { type: String, required: true },
  input_cost_per_1m: { type: Number, required: true },
  output_cost_per_1m: { type: Number, required: true },
  updated_at: { type: Date, default: Date.now }
});

modelPricingSchema.index({ provider: 1, model: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
export const ProviderKey = mongoose.model('ProviderKey', providerKeySchema);
export const WrapperKey = mongoose.model('WrapperKey', wrapperKeySchema);
export const RequestLog = mongoose.model('RequestLog', requestLogSchema);
export const ProviderStats = mongoose.model('ProviderStats', providerStatsSchema);
export const ModelPricing = mongoose.model('ModelPricing', modelPricingSchema);
