const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const dbClient = require('../database/mongodb_client');
const winston = require('winston');
const EventEmitter = require('events');

class DashboardServer extends EventEmitter {
    constructor() {
        super();
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        this.port = process.env.PORT || 3000;
        this.isRunning = false;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketIO();
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                    imgSrc: ["'self'", "data:", "https:"]
                }
            }
        }));
        
        this.app.use(cors());
        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    setupRoutes() {
        // Basic routes
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'OK', 
                timestamp: new Date(),
                version: '1.0.0'
            });
        });

        // API routes
        this.app.get('/api/threats', async (req, res) => {
            try {
                const threats = await dbClient.getCollection('threat_events')
                    .find({})
                    .sort({ timestamp: -1 })
                    .limit(50)
                    .toArray();
                res.json(threats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/blockchain', async (req, res) => {
            try {
                const blocks = await dbClient.getCollection('blockchain_ledger')
                    .find({})
                    .sort({ index: -1 })
                    .limit(50)
                    .toArray();
                res.json(blocks);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Error handling
        this.app.use((err, req, res, next) => {
            winston.error('Dashboard server error:', err);
            res.status(err.status || 500).json({
                error: {
                    message: err.message,
                    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
                }
            });
        });
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            winston.info(`Client connected: ${socket.id}`);
            
            // Send initial data
            this.sendInitialData(socket);

            socket.on('disconnect', () => {
                winston.info(`Client disconnected: ${socket.id}`);
            });

            socket.on('request_update', async () => {
                await this.sendInitialData(socket);
            });
        });

        // Broadcast real-time updates
        this.startBroadcasting();
    }

    async sendInitialData(socket) {
        try {
            const [recentThreats, blockchainStats] = await Promise.all([
                this.getRecentThreats(20),
                this.getBlockchainStats()
            ]);

            socket.emit('initial_data', {
                recentThreats,
                blockchainStats,
                timestamp: new Date()
            });

        } catch (error) {
            winston.error('Error sending initial data:', error);
            socket.emit('error', { message: 'Failed to load initial data' });
        }
    }

    async getRecentThreats(limit = 20) {
        try {
            return await dbClient.getCollection('threat_events')
                .find({})
                .sort({ timestamp: -1 })
                .limit(limit)
                .toArray();
        } catch (error) {
            winston.error('Error getting recent threats:', error);
            return [];
        }
    }

    async getBlockchainStats() {
        try {
            const totalBlocks = await dbClient.getCollection('blockchain_ledger').countDocuments();
            const recentBlocks = await dbClient.getCollection('blockchain_ledger')
                .find({})
                .sort({ index: -1 })
                .limit(10)
                .toArray();

            return {
                totalBlocks,
                recentBlocks: recentBlocks.map(block => ({
                    index: block.index,
                    type: block.data?.type || 'UNKNOWN',
                    timestamp: block.timestamp,
                    hash: block.hash ? block.hash.substring(0, 16) + '...' : 'N/A'
                }))
            };
        } catch (error) {
            winston.error('Error getting blockchain stats:', error);
            return { totalBlocks: 0, recentBlocks: [] };
        }
    }

    startBroadcasting() {
        // Broadcast updates every 5 seconds
        setInterval(async () => {
            try {
                const realTimeData = await this.getRealTimeData();
                this.io.emit('realtime_update', realTimeData);
            } catch (error) {
                winston.error('Error broadcasting real-time data:', error);
            }
        }, 5000);
    }

    async getRealTimeData() {
        const [currentThreats, systemHealth] = await Promise.all([
            this.getRecentThreats(10),
            this.getSystemHealth()
        ]);

        return {
            currentThreats,
            systemHealth,
            timestamp: new Date()
        };
    }

    async getSystemHealth() {
        const os = require('os');
        return {
            cpu: os.loadavg(),
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                usage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
            },
            uptime: os.uptime()
        };
    }

    broadcastThreat(threat) {
        this.io.emit('new_threat', threat);
    }

    broadcastEvent(event) {
        this.io.emit('security_event', event);
    }

    broadcastSystemStatus(status) {
        this.io.emit('system_status', status);
    }

    start() {
        this.server.listen(this.port, () => {
            this.isRunning = true;
            winston.info(`Dashboard server running on http://localhost:${this.port}`);
        });

        this.server.on('error', (error) => {
            winston.error('Dashboard server error:', error);
            this.isRunning = false;
        });
    }

    stop() {
        if (this.server) {
            this.server.close(() => {
                this.isRunning = false;
                winston.info('Dashboard server stopped');
            });
        }
    }
}

module.exports = DashboardServer;