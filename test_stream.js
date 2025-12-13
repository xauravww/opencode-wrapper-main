// Using global fetch


async function testStream() {
    console.log('🚀 Starting streaming test...');
    const start = Date.now();

    try {
        const response = await fetch('http://localhost:3011/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'grok-code',
                messages: [{ role: 'user', content: 'Count from 1 to 5 slowly' }],
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        console.log('✅ Response received. Reading stream...');

        let firstChunkTime = null;
        let chunkCount = 0;

        for await (const chunk of response.body) {
            const now = Date.now();
            if (!firstChunkTime) {
                firstChunkTime = now;
                console.log(`⏱️ First chunk received after ${now - start}ms`);
            }
            chunkCount++;
            process.stdout.write(`[Chunk ${chunkCount} @ ${now - start}ms] ${chunk.length} bytes\n`);
        }

        console.log(`\n🏁 Stream finished. Total chunks: ${chunkCount}`);
        console.log(`Total time: ${Date.now() - start}ms`);
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testStream();
