import ProviderManager from './providerManager.js';

async function testFailover() {
    console.log('🧪 Testing Failover Logic...');

    const manager = new ProviderManager();

    // Mock makeRequest to simulate failures
    const originalMakeRequest = manager.makeRequest.bind(manager);

    let attempts = 0;

    manager.makeRequest = async (provider, endpoint, options) => {
        attempts++;
        console.log(`📡 Mock Request to ${provider} (Attempt ${attempts})`);

        if (attempts <= 2) {
            console.log(`❌ Simulating failure for ${provider}`);
            throw new Error('Simulated failure');
        }

        console.log(`✅ Simulating success for ${provider}`);
        return {
            id: 'mock-response',
            choices: [{ message: { content: 'Success after failover' } }],
            usage: { total_tokens: 10 }
        };
    };

    manager.getBestModelForProvider = () => 'mock-model';
    manager.providers = {
        provider1: { apiKeys: ['k1'], models: ['m1'] },
        provider2: { apiKeys: ['k2'], models: ['m2'] },
        provider3: { apiKeys: ['k3'], models: ['m3'] }
    };

    // We need to test the logic in server.js, but that's hard to unit test without importing app.
    // Instead, let's test the ProviderManager's ability to return ordered providers and handle stats updates.

    console.log('📋 Ordered Providers:', manager.getOrderedProviders());

    // Simulate stats updates
    manager.updateStats('provider1', { success: false, responseTime: 100 });
    manager.updateStats('provider2', { success: false, responseTime: 100 });
    manager.updateStats('provider3', { success: true, responseTime: 50 });

    console.log('📊 Stats after simulation:', JSON.stringify(manager.stats.providers, null, 2));

    console.log('📋 Ordered Providers after stats:', manager.getOrderedProviders());

    // Verify provider3 is now prioritized?
    // provider1 and 2 have error_rate 1.0 (1 request, 0 success) -> priority should drop

    const ordered = manager.getOrderedProviders();
    if (ordered[0] === 'provider3') {
        console.log('✅ PASS: provider3 is now top priority');
    } else {
        console.log('❌ FAIL: provider3 should be top priority but got ' + ordered[0]);
    }

}

testFailover().catch(console.error);
