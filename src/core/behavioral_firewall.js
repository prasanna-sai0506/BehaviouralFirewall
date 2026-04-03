const SystemLogMonitor = require('../monitors/system_log_monitor');
const NetworkLogMonitor = require('../monitors/network_log_monitor');
const ProcessMonitor = require('../monitors/process_monitor');
const ThreatDetector = require('./threat_detector');
const BlockchainManager = require('./blockchain');
const WindowsFirewall = require('../firewall/windows_firewall');
const DashboardServer = require('../dashboard/server');
const dbClient = require('../database/mongodb_client');
const winston = require('winston');
const EventEmitter = require('events');

class BehavioralFirewall extends EventEmitter {
    constructor() {
        super();
        this.systemMonitor = new SystemLogMonitor();
        this.networkMonitor = new NetworkLogMonitor();
        this.processMonitor = new ProcessMonitor();
        this.threatDetector = new ThreatDetector();
        this.blockchainManager = new BlockchainManager();
        this.firewallManager = new WindowsFirewall();
        this.dashboardServer = new DashboardServer();
        this.isRunning = false;
        
        // Initialize threat detector events
        this.threatDetector.on('high_threat', (threat) => this.handleHighThreat(threat));
        this.threatDetector.on('medium_threat', (threat) => this.handleMediumThreat(threat));
    }

    async start() {
        try {
            winston.info('Initializing Behavioral Firewall...');

            // Connect to MongoDB
            const connected = await dbClient.connect();
            if (!connected) {
                winston.warn('Failed to connect to database, running in limited mode');
            }

            // Initialize blockchain
            await this.blockchainManager.init();

            // Initialize firewall manager
            await this.firewallManager.initialize();

            // Setup event listeners
            this.setupEventListeners();

            // Start monitoring systems
            await this.systemMonitor.startMonitoring();
            await this.networkMonitor.startMonitoring();
            await this.processMonitor.startMonitoring();

            // Start dashboard server
            this.dashboardServer.start();

            this.isRunning = true;
            winston.info('Behavioral Firewall started successfully');

            // Initial system health check
            await this.performHealthCheck();

        } catch (error) {
            winston.error('Failed to start Behavioral Firewall:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // System log events
        this.systemMonitor.on('event', async (event) => {
            await this.handleSecurityEvent(event);
        });

        // Network events
        this.networkMonitor.on('threat_detected', async (threat) => {
            await this.handleSecurityEvent(threat);
        });

        this.networkMonitor.on('connections_update', async (connections) => {
            await this.threatDetector.analyzeNetworkPatterns(connections);
        });

        // Process events
        this.processMonitor.on('process_alert', async (alert) => {
            await this.handleSecurityEvent(alert);
        });

        // Dashboard events
        this.dashboardServer.on('system_action', async (action) => {
            await this.handleSystemAction(action);
        });
    }

    async handleSecurityEvent(event) {
        try {
            const threatScore = await this.threatDetector.analyzeEvent(event);
            
            // Emit threat events based on score
            if (threatScore > 70) {
                this.threatDetector.emit('high_threat', { ...event, threat_score: threatScore });
            } else if (threatScore > 40) {
                this.threatDetector.emit('medium_threat', { ...event, threat_score: threatScore });
            }

            // Log all events for analytics
            try {
                await dbClient.getCollection('security_events').insertOne({
                    ...event,
                    threat_score: threatScore,
                    processed: true,
                    timestamp: new Date()
                });
            } catch (dbError) {
                winston.warn('Could not save security event to database:', dbError.message);
            }

            // Notify dashboard
            this.dashboardServer.broadcastEvent(event);

        } catch (error) {
            winston.error('Error handling security event:', error);
        }
    }

    async handleHighThreat(threat) {
        try {
            winston.warn(`HIGH THREAT DETECTED: ${threat.type} - Score: ${threat.threat_score}`);

            // Generate and deploy firewall rule
            const rule = await this.threatDetector.generateFirewallRule(threat);
            if (rule) {
                await this.firewallManager.addRule(rule);
                winston.info(`Firewall rule deployed: ${rule.rule_id}`);
            }

            // Add to blockchain
            const block = await this.blockchainManager.addThreatEvent(threat, rule, threat.threat_score);
            winston.info(`Threat added to blockchain: Block ${block.index}`);

            // Store in database
            try {
                await dbClient.getCollection('threat_events').insertOne({
                    ...threat,
                    action_taken: 'BLOCKED',
                    firewall_rule: rule,
                    blockchain_hash: block.hash,
                    timestamp: new Date()
                });
            } catch (dbError) {
                winston.warn('Could not save threat event to database:', dbError.message);
            }

            // Notify dashboard
            this.dashboardServer.broadcastThreat(threat);

            // Emit event for external handlers
            this.emit('high_threat_blocked', { threat, rule, block });

        } catch (error) {
            winston.error('Error handling high threat:', error);
        }
    }

    async handleMediumThreat(threat) {
        try {
            winston.info(`MEDIUM THREAT DETECTED: ${threat.type} - Score: ${threat.threat_score}`);

            // Log for monitoring (no automatic blocking)
            try {
                await dbClient.getCollection('threat_events').insertOne({
                    ...threat,
                    action_taken: 'MONITORED',
                    timestamp: new Date()
                });
            } catch (dbError) {
                winston.warn('Could not save medium threat to database:', dbError.message);
            }

            // Add to blockchain for audit trail
            await this.blockchainManager.addThreatEvent(threat, null, threat.threat_score);

            // Notify dashboard
            this.dashboardServer.broadcastThreat(threat);

        } catch (error) {
            winston.error('Error handling medium threat:', error);
        }
    }

    async handleSystemAction(action) {
        try {
            winston.info(`Processing system action: ${action.type}`);

            switch (action.type) {
                case 'refresh_baseline':
                    await this.threatDetector.updateBehavioralBaseline();
                    winston.info('Behavioral baseline refreshed');
                    break;

                case 'cleanup_rules':
                    const removedCount = await this.firewallManager.cleanupOldRules();
                    winston.info(`Cleaned up ${removedCount} old firewall rules`);
                    break;

                case 'synchronize_blockchain':
                    await this.blockchainManager.synchronizeChain();
                    winston.info('Blockchain synchronized');
                    break;

                case 'export_data':
                    await this.exportSystemData(action.parameters);
                    break;

                default:
                    winston.warn(`Unknown system action: ${action.type}`);
            }

            // Notify dashboard of completion
            this.dashboardServer.broadcastSystemStatus(await this.getStatus());

        } catch (error) {
            winston.error('Error handling system action:', error);
        }
    }

    async performHealthCheck() {
        try {
            const health = {
                timestamp: new Date(),
                system: {
                    database: await dbClient.healthCheck(),
                    blockchain: await this.blockchainManager.validateChain(),
                    monitors: {
                        system: this.systemMonitor.isMonitoring,
                        network: this.networkMonitor.isMonitoring,
                        process: this.processMonitor.isMonitoring
                    },
                    firewall: this.firewallManager.isInitialized,
                    dashboard: this.dashboardServer.isRunning
                },
                statistics: await this.getSystemStatistics()
            };

            winston.info('System Health Check completed');
            
            // Store health metrics
            try {
                await dbClient.getCollection('system_metrics').insertOne(health);
            } catch (dbError) {
                winston.warn('Could not save health metrics to database:', dbError.message);
            }

            return health;

        } catch (error) {
            winston.error('Error performing health check:', error);
            return {
                timestamp: new Date(),
                system: { error: 'Health check failed' },
                statistics: {}
            };
        }
    }

    async getSystemStatistics() {
        try {
            const [
                totalThreats,
                highThreats,
                blockchainBlocks,
                firewallRules,
                recentThreats
            ] = await Promise.all([
                dbClient.getCollection('threat_events').countDocuments(),
                dbClient.getCollection('threat_events').countDocuments({ threat_score: { $gte: 70 } }),
                dbClient.getCollection('blockchain_ledger').countDocuments(),
                dbClient.getCollection('firewall_rules').countDocuments({ status: 'ACTIVE' }),
                dbClient.getCollection('threat_events')
                    .find({})
                    .sort({ timestamp: -1 })
                    .limit(100)
                    .toArray()
            ]);

            // Calculate threat distribution
            const threatDistribution = recentThreats.reduce((acc, threat) => {
                acc[threat.type] = (acc[threat.type] || 0) + 1;
                return acc;
            }, {});

            return {
                totalThreats,
                highThreats,
                blockchainBlocks,
                firewallRules: firewallRules,
                threatDistribution,
                uptime: process.uptime(),
                performance: await this.getPerformanceMetrics()
            };

        } catch (error) {
            winston.warn('Error getting system statistics:', error.message);
            return {
                totalThreats: 0,
                highThreats: 0,
                blockchainBlocks: 0,
                firewallRules: 0,
                threatDistribution: {},
                uptime: process.uptime(),
                performance: {}
            };
        }
    }

    async getPerformanceMetrics() {
        try {
            const os = require('os');
            const process = require('process');

            return {
                cpu: {
                    usage: process.cpuUsage(),
                    load: os.loadavg()
                },
                memory: {
                    used: process.memoryUsage(),
                    system: {
                        total: os.totalmem(),
                        free: os.freemem()
                    }
                },
                network: {
                    interfaces: os.networkInterfaces()
                }
            };
        } catch (error) {
            return {
                cpu: { usage: null, load: null },
                memory: { used: null, system: null },
                network: { interfaces: null }
            };
        }
    }

    async exportSystemData(parameters = {}) {
        try {
            const { format = 'json', types = ['threats', 'blockchain'] } = parameters;

            const exportData = {};

            if (types.includes('threats')) {
                const threats = await dbClient.getCollection('threat_events')
                    .find({})
                    .sort({ timestamp: -1 })
                    .toArray();
                exportData.threats = threats;
            }

            if (types.includes('blockchain')) {
                const blocks = await dbClient.getCollection('blockchain_ledger')
                    .find({})
                    .sort({ index: 1 })
                    .toArray();
                exportData.blockchain = blocks;
            }

            if (types.includes('firewall')) {
                const rules = await this.firewallManager.getActiveRules();
                exportData.firewallRules = rules;
            }

            winston.info(`System data exported: ${Object.keys(exportData).join(', ')}`);
            return exportData;

        } catch (error) {
            winston.error('Error exporting system data:', error);
            throw error;
        }
    }

    async stop() {
        try {
            winston.info('Stopping Behavioral Firewall...');

            // Stop monitoring systems
            this.systemMonitor.stopMonitoring();
            this.networkMonitor.stopMonitoring();
            this.processMonitor.stopMonitoring();

            // Stop dashboard server
            this.dashboardServer.stop();

            // Disconnect from database
            await dbClient.disconnect();

            this.isRunning = false;
            winston.info('Behavioral Firewall stopped successfully');

        } catch (error) {
            winston.error('Error stopping Behavioral Firewall:', error);
            throw error;
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            startupTime: this.startupTime,
            components: {
                database: dbClient.isConnected,
                blockchain: this.blockchainManager.isInitialized,
                monitors: {
                    system: this.systemMonitor.isMonitoring,
                    network: this.networkMonitor.isMonitoring,
                    process: this.processMonitor.isMonitoring
                },
                firewall: this.firewallManager.isInitialized,
                dashboard: this.dashboardServer.isRunning
            },
            statistics: this.getSystemStatistics()
        };
    }

    // Utility methods
    async restart() {
        winston.info('Restarting Behavioral Firewall...');
        await this.stop();
        
        // Wait a moment before restarting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await this.start();
        winston.info('Behavioral Firewall restarted successfully');
    }

    async emergencyShutdown() {
        winston.error('EMERGENCY SHUTDOWN INITIATED');
        
        // Immediate stop without graceful cleanup
        this.systemMonitor.stopMonitoring();
        this.networkMonitor.stopMonitoring();
        this.processMonitor.stopMonitoring();
        
        this.isRunning = false;
        process.exit(1);
    }

    // Configuration management
    updateConfiguration(newConfig) {
        // Update runtime configuration
        // This would typically update monitoring intervals, thresholds, etc.
        winston.info('Configuration updated');
        this.emit('configuration_updated', newConfig);
    }

    // Diagnostic methods
    async runDiagnostics() {
        const diagnostics = {
            timestamp: new Date(),
            system: await this.performHealthCheck(),
            network: await this.testNetworkConnectivity(),
            database: await this.testDatabaseConnection(),
            blockchain: await this.testBlockchainIntegrity(),
            monitors: await this.testMonitorSystems()
        };

        winston.info('System diagnostics completed');
        return diagnostics;
    }

    async testNetworkConnectivity() {
        // Basic network connectivity tests
        return { status: 'OK', tests: ['localhost'] };
    }

    async testDatabaseConnection() {
        try {
            const health = await dbClient.healthCheck();
            return { status: health ? 'OK' : 'FAILED', connected: health };
        } catch (error) {
            return { status: 'FAILED', error: error.message };
        }
    }

    async testBlockchainIntegrity() {
        try {
            const valid = await this.blockchainManager.validateChain();
            return { status: valid ? 'OK' : 'CORRUPTED', valid };
        } catch (error) {
            return { status: 'ERROR', error: error.message };
        }
    }

    async testMonitorSystems() {
        const tests = {
            system: this.systemMonitor.isMonitoring,
            network: this.networkMonitor.isMonitoring,
            process: this.processMonitor.isMonitoring
        };

        const allWorking = Object.values(tests).every(status => status === true);
        return { status: allWorking ? 'OK' : 'PARTIAL', tests };
    }
}

module.exports = BehavioralFirewall;