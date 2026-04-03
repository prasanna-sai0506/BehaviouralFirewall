const express = require('express');
const router = express.Router();
const path = require('path');

// Serve main dashboard
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

router.get('/threats', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/threats.html'));
});

router.get('/blockchain', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/blockchain.html'));
});

router.get('/analytics', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/analytics.html'));
});

router.get('/firewall', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/firewall.html'));
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        version: '1.0.0'
    });
});

module.exports = router;