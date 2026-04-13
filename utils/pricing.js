import { ModelPricing } from '../db/mongo.js';

export const PRICING = {
    'openai': { input: 2.50, output: 10.00 },
    'anthropic': { input: 3.00, output: 15.00 },
    'google': { input: 0.35, output: 1.05 },
    'mistral': { input: 2.00, output: 6.00 },
    'groq': { input: 0.59, output: 0.79 },
    'cerebras': { input: 0.00, output: 0.00 },
    'together': { input: 0.20, output: 0.20 },
    'deepseek': { input: 0.14, output: 0.28 },
    'nvidia': { input: 0.65, output: 2.20 },
    'opencode': { input: 0.50, output: 1.50 },
    'aitools': { input: 0.10, output: 0.30 },
    'default': { input: 0.50, output: 1.50 }
};

export async function getPricing(provider, model) {
    if (model) {
        try {
            const dbPricing = await ModelPricing.findOne({ provider, model });
            if (dbPricing) {
                return { input: dbPricing.input_cost_per_1m, output: dbPricing.output_cost_per_1m };
            }
        } catch (e) {
            console.warn(`Failed to fetch pricing for ${provider}/${model} from DB, using fallback.`);
        }
    }
    return PRICING[provider] || PRICING['default'];
}

export async function calculateCost(usage, provider, model) {
    const pricing = await getPricing(provider, model);
    const inputCost = ((usage.prompt_tokens || 0) / 1000000) * pricing.input;
    const outputCost = ((usage.completion_tokens || 0) / 1000000) * pricing.output;
    return inputCost + outputCost;
}
