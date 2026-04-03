const { ethers } = require('ethers');
const dbClient = require('../database/mongodb_client');
const winston = require('winston');

class BlockchainManager {
    constructor() {
        this.chain = [];
        this.pendingTransactions = [];
        this.difficulty = 2;
        this.miningReward = 100;
        this.isInitialized = false;
        this.networkNodes = [];
    }

    async init() {
        try {
            // Load existing blockchain from MongoDB
            const existingChain = await dbClient.getCollection('blockchain_ledger')
                .find({})
                .sort({ index: 1 })
                .toArray();

            if (existingChain.length === 0) {
                await this.createGenesisBlock();
                winston.info('Genesis block created');
            } else {
                this.chain = existingChain;
                winston.info(`Blockchain loaded with ${this.chain.length} blocks`);
            }

            // Validate the chain
            const isValid = await this.validateChain();
            if (!isValid) {
                winston.warn('Blockchain validation failed. Chain may be corrupted.');
            }

            this.isInitialized = true;
            winston.info('Blockchain manager initialized successfully');

        } catch (error) {
            winston.error('Error initializing blockchain:', error);
            throw error;
        }
    }

    async createGenesisBlock() {
        const genesisBlock = {
            index: 0,
            timestamp: new Date(),
            data: {
                type: 'GENESIS',
                message: 'Behavioral Firewall Blockchain Initialized',
                system_info: {
                    hostname: require('os').hostname(),
                    platform: process.platform,
                    version: '1.0.0'
                }
            },
            previousHash: '0',
            hash: this.calculateHash(0, new Date(), { type: 'GENESIS' }, '0'),
            nonce: 0
        };

        await dbClient.getCollection('blockchain_ledger').insertOne(genesisBlock);
        this.chain.push(genesisBlock);
    }

    calculateHash(index, timestamp, data, previousHash, nonce = 0) {
        return ethers.keccak256(
            ethers.toUtf8Bytes(
                index + timestamp + JSON.stringify(data) + previousHash + nonce
            )
        );
    }

    async addThreatEvent(threatEvent, firewallRule, threatScore) {
        try {
            const blockData = {
                type: 'THREAT_DETECTED',
                threat_event: {
                    type: threatEvent.type,
                    source: threatEvent.source,
                    risk_level: threatEvent.risk_level,
                    threat_score: threatScore,
                    description: threatEvent.description
                },
                firewall_rule: firewallRule ? {
                    rule_id: firewallRule.rule_id,
                    type: firewallRule.type,
                    action: firewallRule.action
                } : null,
                node_id: require('os').hostname(),
                timestamp: new Date()
            };

            const newBlock = await this.addBlock(blockData);
            
            // Propagate to other nodes (in a real implementation)
            await this.propagateBlock(newBlock);

            winston.info(`Threat event added to blockchain: ${threatEvent.type}`);
            return newBlock;

        } catch (error) {
            winston.error('Error adding threat event to blockchain:', error);
            throw error;
        }
    }

    async addBlock(data) {
        const previousBlock = this.chain[this.chain.length - 1];
        const newIndex = previousBlock.index + 1;
        const newTimestamp = new Date();

        // Mine the block (proof-of-work)
        const { hash, nonce } = await this.mineBlock(newIndex, newTimestamp, data, previousBlock.hash);

        const newBlock = {
            index: newIndex,
            timestamp: newTimestamp,
            data: data,
            previousHash: previousBlock.hash,
            hash: hash,
            nonce: nonce
        };

        // Add to chain
        this.chain.push(newBlock);
        
        // Store in MongoDB
        await dbClient.getCollection('blockchain_ledger').insertOne(newBlock);

        winston.info(`New block added: ${newBlock.hash.substring(0, 16)}...`);
        return newBlock;
    }

    async mineBlock(index, timestamp, data, previousHash) {
        let nonce = 0;
        let hash = '';

        winston.info('Mining new block...');

        // Simple proof-of-work
        do {
            nonce++;
            hash = this.calculateHash(index, timestamp, data, previousHash, nonce);
        } while (!hash.startsWith('0'.repeat(this.difficulty)));

        winston.info(`Block mined with nonce: ${nonce}`);
        return { hash, nonce };
    }

    async propagateBlock(block) {
        // In a real implementation, this would broadcast to other nodes
        // For now, we'll simulate this by storing propagation info
        
        const propagationInfo = {
            block_hash: block.hash,
            propagated_to: this.networkNodes,
            timestamp: new Date(),
            status: 'PROPAGATED'
        };

        await dbClient.getCollection('blockchain_propagation').insertOne(propagationInfo);
        winston.info('Block propagated to network (simulated)');
    }

    async validateChain() {
        winston.info('Validating blockchain...');

        // Check genesis block
        const genesisBlock = this.chain[0];
        if (genesisBlock.index !== 0 || 
            genesisBlock.previousHash !== '0' ||
            genesisBlock.hash !== this.calculateHash(0, genesisBlock.timestamp, genesisBlock.data, '0', genesisBlock.nonce)) {
            winston.error('Genesis block validation failed');
            return false;
        }

        // Check subsequent blocks
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            // Check hash linkage
            if (currentBlock.previousHash !== previousBlock.hash) {
                winston.error(`Block ${i} hash linkage invalid`);
                return false;
            }

            // Check block hash
            if (currentBlock.hash !== this.calculateHash(
                currentBlock.index,
                currentBlock.timestamp,
                currentBlock.data,
                currentBlock.previousHash,
                currentBlock.nonce
            )) {
                winston.error(`Block ${i} hash invalid`);
                return false;
            }

            // Check proof-of-work
            if (!currentBlock.hash.startsWith('0'.repeat(this.difficulty))) {
                winston.error(`Block ${i} proof-of-work invalid`);
                return false;
            }
        }

        winston.info('Blockchain validation successful');
        return true;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    async getBlockchainStats() {
        const totalBlocks = this.chain.length;
        const threatEvents = this.chain.filter(block => 
            block.data.type === 'THREAT_DETECTED'
        ).length;

        const recentBlocks = this.chain.slice(-10).map(block => ({
            index: block.index,
            type: block.data.type,
            timestamp: block.timestamp,
            hash: block.hash.substring(0, 16) + '...'
        }));

        return {
            totalBlocks,
            threatEvents,
            recentBlocks,
            chainValid: await this.validateChain(),
            networkNodes: this.networkNodes.length
        };
    }

    async searchBlockchain(query) {
        const results = await dbClient.getCollection('blockchain_ledger')
            .find({
                $or: [
                    { 'data.type': { $regex: query, $options: 'i' } },
                    { 'data.threat_event.type': { $regex: query, $options: 'i' } },
                    { 'data.threat_event.description': { $regex: query, $options: 'i' } },
                    { hash: { $regex: query, $options: 'i' } }
                ]
            })
            .sort({ index: -1 })
            .limit(50)
            .toArray();

        return results;
    }

    async exportBlockchain(format = 'json') {
        const blocks = await dbClient.getCollection('blockchain_ledger')
            .find({})
            .sort({ index: 1 })
            .toArray();

        if (format === 'csv') {
            return this.convertToCSV(blocks);
        }

        return blocks;
    }

    convertToCSV(blocks) {
        if (blocks.length === 0) return '';
        
        const headers = ['Index', 'Timestamp', 'Type', 'Previous Hash', 'Hash', 'Nonce'];
        const rows = blocks.map(block => [
            block.index,
            block.timestamp,
            block.data.type,
            block.previousHash.substring(0, 16) + '...',
            block.hash.substring(0, 16) + '...',
            block.nonce
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n');
        
        return csv;
    }

    async addNetworkNode(nodeUrl) {
        if (!this.networkNodes.includes(nodeUrl)) {
            this.networkNodes.push(nodeUrl);
            winston.info(`Network node added: ${nodeUrl}`);
        }
    }

    async synchronizeChain() {
        // In a real implementation, this would synchronize with other nodes
        winston.info('Blockchain synchronization triggered');
        // This would involve comparing chains and resolving conflicts
    }
}

module.exports = BlockchainManager;