import dotenv from 'dotenv';
import ProviderManager from './providerManager.js';

dotenv.config();

async function test() {
    const pm = new ProviderManager();
    // Wait a bit for initialization (though sync part is instant)

    const providers = pm.getOrderedProviders();
    console.log('Top Provider:', providers[0]);

    if (providers.length > 0) {
        const bestModel = pm.getBestModelForProvider(providers[0]);
        console.log('Best Model:', bestModel);
    } else {
        console.log('No providers available.');
    }

    process.exit(0);
}

test();
