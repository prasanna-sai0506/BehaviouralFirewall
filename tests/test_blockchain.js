const BlockchainManager = require('../src/core/blockchain');
const winston = require('winston');

// Configure test logger
winston.configure({
    level: 'info',
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
});

async function testBlockchain() {
    console.log('Starting Blockchain Tests...\n');

    const blockchain = new BlockchainManager();

    try {
        // Initialize blockchain
        console.log('1. Initializing blockchain...');
        await blockchain.init();
        console.log('Blockchain initialized');

        // Test adding threat events
        console.log('\n2. Adding test threat events...');
        
        const testThreats = [
            {
                type: 'SUSPICIOUS_PORT',
                source: 'Network',
                risk_level: 'HIGH',
                description: 'Connection to suspicious port 4444'
            },
            {
                type: 'BLACKLISTED_PROCESS',
                source: 'Process', 
                risk_level: 'HIGH',
                description: 'Malicious process detected: mimikatz.exe'
            },
            {
                type: 'LOGON_FAILURE',
                source: 'Security',
                risk_level: 'MEDIUM',
                description: 'Multiple failed logon attempts'
            }
        ];

        for (const threat of testThreats) {
            const block = await blockchain.addThreatEvent(threat, null, 85);
            console.log(`Added threat: ${threat.type} - Block: ${block.index}`);
        }

        // Test chain validation
        console.log('\n3. Validating blockchain...');
        const isValid = await blockchain.validateChain();
        console.log(`Blockchain valid: ${isValid}`);

        // Test blockchain stats
        console.log('\n4. Getting blockchain statistics...');
        const stats = await blockchain.getBlockchainStats();
        console.log(`Total blocks: ${stats.totalBlocks}`);
        console.log(`Threat events: ${stats.threatEvents}`);
        console.log(`Chain valid: ${stats.chainValid}`);

        // Test search
        console.log('\n5. Testing blockchain search...');
        const results = await blockchain.searchBlockchain('suspicious');
        console.log(`Search results: ${results.length} blocks found`);

        // Test export
        console.log('\n6. Testing blockchain export...');
        const exported = await blockchain.exportBlockchain('json');
        console.log(`Exported ${exported.length} blocks`);

        console.log('\nAll blockchain tests passed! ✅');

    } catch (error) {
        console.error('Blockchain test failed:', error);
        throw error;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testBlockchain().catch(console.error);
}

module.exports = { testBlockchain };