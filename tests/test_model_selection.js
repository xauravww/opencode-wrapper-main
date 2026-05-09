import dotenv from 'dotenv';
import ProviderManager from '../providerManager.js';

dotenv.config();

async function test() {
    const pm = new ProviderManager();
    await new Promise(r => setTimeout(r, 500));

    const providers = pm.getOrderedProviders();
    console.log('Top Providers:', providers.slice(0, 3));

    for (const provider of providers.slice(0, 3)) {
        const model = pm.getBestModelForProvider(provider);
        console.log(`  ${provider}: ${model}`);
    }

    const { provider: best, model: bestModel } = pm.getBestModel();
    console.log('Best:', best, bestModel);

    const status = pm.getProviderStatus();
    console.log('\n--- Provider Status ---');
    for (const [name, s] of Object.entries(status)) {
        if (s.configured) {
            console.log(`  ${name}: ${s.health_status} (latency: ${Math.round(s.avg_latency)}ms)`);
        }
    }

    process.exit(0);
}

test();