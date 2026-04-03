const EventEmitter = require('events');
const winston = require('winston');
const dbClient = require('../database/mongodb_client');

class ThreatDetector extends EventEmitter {
    constructor() {
        super();
        this.behavioralBaseline = {};
        this.threatPatterns = this.initializeThreatPatterns();
    }

    initializeThreatPatterns() {
        return {
            system: {
                'RAPID_LOGON_FAILURES': { threshold: 5, timeframe: 300000, score: 80 },
                'PRIVILEGE_ESCALATION_SEQUENCE': { pattern: ['4672', '4674'], score: 90 }
            },
            network: {
                'PORT_SCANNING': { threshold: 10, timeframe: 60000, score: 85 },
                'SUSPICIOUS_PORT_CONNECTIONS': { ports: [4444, 1337, 31337], score: 70 }
            },
            process: {
                'MEMORY_INJECTION': { score: 90 },
                'PROCESS_HOLLOWING': { score: 95 },
                'LOLBIN_ABUSE': { score: 80 }
            }
        };
    }

    async analyzeEvent(event) {
        try {
            let threatScore = 0;

            // Base score from event type and risk level
            threatScore += this.calculateBaseScore(event);

            // Pattern-based analysis
            threatScore += await this.analyzePatterns(event);

            // Ensure score is between 0-100
            threatScore = Math.min(Math.max(threatScore, 0), 100);

            winston.debug(`Threat score for ${event.type}: ${threatScore}`);

            return threatScore;

        } catch (error) {
            winston.error('Error analyzing event:', error);
            return 0;
        }
    }

    calculateBaseScore(event) {
        const riskScores = {
            'LOW': 20,
            'MEDIUM': 50,
            'HIGH': 80
        };

        const typeScores = {
            'PRIVILEGE_ESCALATION': 80,
            'SUSPICIOUS_PORT': 70,
            'PORT_SCANNING': 85,
            'LOGON_FAILURE': 30,
            'SUSPICIOUS_POWERSHELL': 75,
            'LOLBIN_ABUSE': 80
        };

        let score = riskScores[event.risk_level] || 30;
        score += typeScores[event.type] || 0;

        return Math.min(score, 80);
    }

    async analyzePatterns(event) {
        let patternScore = 0;

        // Check for rapid failures (brute force)
        if (event.type === 'LOGON_FAILURE') {
            patternScore += await this.checkRapidFailures(event);
        }

        // Check for known attack patterns
        patternScore += this.checkKnownPatterns(event);

        return patternScore;
    }

    async checkRapidFailures(event) {
        const timeframe = 5 * 60 * 1000; // 5 minutes
        const threshold = 5;

        try {
            const recentFailures = await dbClient.getCollection('security_events')
                .countDocuments({
                    type: 'LOGON_FAILURE',
                    timestamp: { $gte: new Date(Date.now() - timeframe) }
                });

            if (recentFailures >= threshold) {
                return 20; // Additional score for rapid failures
            }
        } catch (error) {
            winston.error('Error checking rapid failures:', error);
        }

        return 0;
    }

    checkKnownPatterns(event) {
        let score = 0;

        // PowerShell patterns
        if (event.type === 'SUSPICIOUS_POWERSHELL') {
            const data = event.data?.Message || '';
            if (data.includes('FromBase64String') || data.includes('DownloadString')) {
                score += 15;
            }
        }

        // Network patterns
        if (event.type === 'SUSPICIOUS_PORT_CONNECTION') {
            score += 10;
        }

        // Process patterns
        if (event.type === 'LOLBIN_ABUSE') {
            score += 15;
        }

        return score;
    }

    async generateFirewallRule(threat) {
        try {
            let rule = null;

            switch (threat.type) {
                case 'SUSPICIOUS_PROCESS_NAME':
                case 'LOLBIN_ABUSE':
                    rule = await this.generateProcessBlockRule(threat);
                    break;

                case 'SUSPICIOUS_PORT_CONNECTION':
                    rule = await this.generateNetworkBlockRule(threat);
                    break;

                default:
                    rule = await this.generateGenericBlockRule(threat);
            }

            if (rule) {
                winston.info(`Generated firewall rule: ${rule.rule_id}`);
                return rule;
            }

        } catch (error) {
            winston.error('Error generating firewall rule:', error);
        }

        return null;
    }

    async generateProcessBlockRule(threat) {
        const processData = threat.data;
        const processName = processData.Name;

        return {
            rule_id: `BLOCK_PROCESS_${processName}_${Date.now()}`,
            type: 'PROCESS_BLOCK',
            target: processName,
            description: `Block suspicious process: ${processName}`,
            action: 'BLOCK',
            priority: 'HIGH',
            timestamp: new Date()
        };
    }

    async generateNetworkBlockRule(threat) {
        const connectionData = threat.data;
        const remoteIP = this.extractIP(connectionData.remoteAddress);

        return {
            rule_id: `BLOCK_NETWORK_${remoteIP}_${Date.now()}`,
            type: 'NETWORK_BLOCK',
            target: remoteIP,
            description: `Block connection to suspicious IP: ${remoteIP}`,
            action: 'BLOCK',
            direction: 'OUTBOUND',
            priority: 'HIGH',
            timestamp: new Date()
        };
    }

    async generateGenericBlockRule(threat) {
        return {
            rule_id: `GENERIC_BLOCK_${threat.type}_${Date.now()}`,
            type: 'GENERIC_BLOCK',
            target: 'system',
            description: `Generic block rule for threat: ${threat.type}`,
            action: 'MONITOR',
            priority: 'MEDIUM',
            timestamp: new Date()
        };
    }

    extractIP(address) {
        const match = address.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
        return match ? match[1] : null;
    }

    async updateBehavioralBaseline() {
        winston.info('Updating behavioral baseline...');
        // Implementation would analyze normal behavior patterns
        return true;
    }

    async analyzeNetworkPatterns(connections) {
        // Analyze network connection patterns
        winston.debug(`Analyzing ${connections.length} network connections`);
        return [];
    }
}

module.exports = ThreatDetector;