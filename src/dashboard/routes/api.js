const express = require('express');
const router = express.Router();
const dbClient = require('../../database/mongodb_client');

// Get all threats with pagination
router.get('/threats', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const type = req.query.type;
        const riskLevel = req.query.risk_level;

        let query = {};
        if (type) query.type = type;
        if (riskLevel) query.risk_level = riskLevel;

        const [threats, total] = await Promise.all([
            dbClient.getCollection('threat_events')
                .find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            dbClient.getCollection('threat_events').countDocuments(query)
        ]);

        res.json({
            threats,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get threat statistics
router.get('/stats/threats', async (req, res) => {
    try {
        const timeRange = req.query.range || '24h';
        let startTime = new Date();

        switch (timeRange) {
            case '1h':
                startTime.setHours(startTime.getHours() - 1);
                break;
            case '6h':
                startTime.setHours(startTime.getHours() - 6);
                break;
            case '24h':
                startTime.setDate(startTime.getDate() - 1);
                break;
            case '7d':
                startTime.setDate(startTime.getDate() - 7);
                break;
            case '30d':
                startTime.setDate(startTime.getDate() - 30);
                break;
        }

        const stats = await dbClient.getCollection('threat_events').aggregate([
            { $match: { timestamp: { $gte: startTime } } },
            { $group: {
                _id: { 
                    hour: { $hour: '$timestamp' },
                    type: '$type'
                },
                count: { $sum: 1 },
                avgScore: { $avg: '$threat_score' }
            } },
            { $sort: { '_id.hour': 1 } }
        ]).toArray();

        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get blockchain data
router.get('/blockchain', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const [blocks, total] = await Promise.all([
            dbClient.getCollection('blockchain_ledger')
                .find({})
                .sort({ index: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            dbClient.getCollection('blockchain_ledger').countDocuments()
        ]);

        res.json({
            blocks,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get firewall rules
router.get('/firewall/rules', async (req, res) => {
    try {
        const rules = await dbClient.getCollection('firewall_rules')
            .find({ status: 'ACTIVE' })
            .sort({ created_at: -1 })
            .toArray();

        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get system health
router.get('/system/health', async (req, res) => {
    try {
        const BehavioralFirewall = require('../../core/behavioral_firewall');
        const firewall = new BehavioralFirewall();
        
        const health = await firewall.performHealthCheck();
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search across all collections
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 characters long' });
        }

        const [threats, blocks] = await Promise.all([
            dbClient.getCollection('threat_events')
                .find({
                    $or: [
                        { type: { $regex: query, $options: 'i' } },
                        { description: { $regex: query, $options: 'i' } },
                        { source: { $regex: query, $options: 'i' } }
                    ]
                })
                .sort({ timestamp: -1 })
                .limit(25)
                .toArray(),
            dbClient.getCollection('blockchain_ledger')
                .find({
                    $or: [
                        { 'data.type': { $regex: query, $options: 'i' } },
                        { 'data.threat_event.type': { $regex: query, $options: 'i' } },
                        { hash: { $regex: query, $options: 'i' } }
                    ]
                })
                .sort({ index: -1 })
                .limit(25)
                .toArray()
        ]);

        res.json({
            threats,
            blocks,
            total: threats.length + blocks.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export data
router.get('/export', async (req, res) => {
    try {
        const format = req.query.format || 'json';
        const type = req.query.type || 'threats';

        let data;
        let filename;

        switch (type) {
            case 'threats':
                data = await dbClient.getCollection('threat_events')
                    .find({})
                    .sort({ timestamp: -1 })
                    .toArray();
                filename = 'threats_export';
                break;
            case 'blockchain':
                const blockchain = require('../../core/blockchain');
                data = await blockchain.exportBlockchain(format);
                filename = 'blockchain_export';
                break;
            case 'firewall':
                const firewall = require('../../firewall/windows_firewall');
                data = await firewall.exportRules(format);
                filename = 'firewall_rules_export';
                break;
            default:
                return res.status(400).json({ error: 'Invalid export type' });
        }

        if (format === 'csv') {
            res.header('Content-Type', 'text/csv');
            res.attachment(`${filename}.csv`);
            res.send(data);
        } else {
            res.json(data);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// System actions
router.post('/system/action', async (req, res) => {
    try {
        const { action, parameters } = req.body;

        switch (action) {
            case 'refresh_baseline':
                const threatDetector = require('../../core/threat_detector');
                await threatDetector.updateBehavioralBaseline();
                res.json({ message: 'Behavioral baseline refreshed successfully' });
                break;

            case 'cleanup_rules':
                const firewall = require('../../firewall/windows_firewall');
                const count = await firewall.cleanupOldRules();
                res.json({ message: `Cleaned up ${count} old firewall rules` });
                break;

            case 'synchronize_blockchain':
                const blockchain = require('../../core/blockchain');
                await blockchain.synchronizeChain();
                res.json({ message: 'Blockchain synchronization completed' });
                break;

            default:
                res.status(400).json({ error: 'Unknown action' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;