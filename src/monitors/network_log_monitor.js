const { exec } = require('child_process');
const EventEmitter = require('events');
const winston = require('winston');
const dbClient = require('../database/mongodb_client');

class NetworkLogMonitor extends EventEmitter {
    constructor() {
        super();
        this.isMonitoring = false;
        this.monitoringIntervals = [];
        this.connectionCache = new Map();
        this.suspiciousPorts = [4444, 1337, 31337, 12345, 54321, 9999, 6660, 6667];
        this.knownMaliciousIPs = new Set();
    }

    async startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        winston.info('Starting network log monitoring...');

        // Load known malicious IPs
        await this.loadMaliciousIPs();

        // Start monitoring
        this.monitoringIntervals.push(
            this.monitorNetworkConnections(),
            this.monitorPortActivity(),
            this.monitorDNSQueries(),
            this.monitorNetworkTraffic()
        );

        winston.info('Network log monitoring started successfully');
    }

    async loadMaliciousIPs() {
        try {
            // This could be extended to load from external threat intelligence feeds
            const maliciousIPs = await dbClient.getCollection('threat_intelligence')
                ?.find({ type: 'MALICIOUS_IP' })
                .toArray();
            
            if (maliciousIPs) {
                maliciousIPs.forEach(ip => this.knownMaliciousIPs.add(ip.value));
            }
        } catch (error) {
            winston.error('Error loading malicious IPs:', error);
        }
    }

    monitorNetworkConnections() {
        return setInterval(() => {
            exec('netstat -ano', (error, stdout) => {
                if (error) {
                    winston.error('Error executing netstat:', error);
                    return;
                }

                this.analyzeConnections(stdout);
            });
        }, 3000);
    }

    monitorPortActivity() {
        return setInterval(() => {
            exec('netstat -an | findstr LISTENING', (error, stdout) => {
                if (!error) {
                    this.analyzeListeningPorts(stdout);
                }
            });
        }, 10000);
    }

    monitorDNSQueries() {
        return setInterval(() => {
            // Monitor DNS cache for suspicious domains
            exec('ipconfig /displaydns', (error, stdout) => {
                if (!error) {
                    this.analyzeDNSCache(stdout);
                }
            });
        }, 30000);
    }

    monitorNetworkTraffic() {
        return setInterval(() => {
            // Use PowerShell to get more detailed network information
            const command = `Get-NetTCPConnection -State Established | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, OwningProcess, CreationTime | ConvertTo-Json`;
            
            exec(`powershell "${command}"`, { shell: 'powershell.exe' }, (error, stdout) => {
                if (!error && stdout) {
                    try {
                        const connections = JSON.parse(stdout);
                        this.analyzeDetailedConnections(Array.isArray(connections) ? connections : [connections]);
                    } catch (parseError) {
                        winston.error('Error parsing network connections:', parseError);
                    }
                }
            });
        }, 5000);
    }

    analyzeConnections(netstatOutput) {
        const lines = netstatOutput.split('\n');
        const connections = [];

        lines.forEach(line => {
            if (line.includes('TCP') || line.includes('UDP')) {
                const connection = this.parseConnectionLine(line);
                if (connection) {
                    connections.push(connection);
                    this.detectSuspiciousConnection(connection);
                }
            }
        });

        this.emit('connections_update', connections);
    }

    parseConnectionLine(line) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
            const protocol = parts[0];
            const localAddress = parts[1];
            const remoteAddress = parts[2];
            const state = parts[3] || 'N/A';
            const pid = parts[4];

            return {
                protocol,
                localAddress,
                remoteAddress,
                state,
                pid: parseInt(pid),
                timestamp: new Date()
            };
        }
        return null;
    }

    detectSuspiciousConnection(connection) {
        const threats = [];

        // Check for suspicious ports
        const remotePort = this.extractPort(connection.remoteAddress);
        if (remotePort && this.suspiciousPorts.includes(remotePort)) {
            threats.push({
                type: 'SUSPICIOUS_PORT_CONNECTION',
                risk_level: 'HIGH',
                description: `Connection to known suspicious port ${remotePort}`
            });
        }

        // Check for known malicious IPs
        const remoteIP = this.extractIP(connection.remoteAddress);
        if (remoteIP && this.knownMaliciousIPs.has(remoteIP)) {
            threats.push({
                type: 'MALICIOUS_IP_CONNECTION',
                risk_level: 'HIGH',
                description: `Connection to known malicious IP ${remoteIP}`
            });
        }

        // Detect port scanning patterns
        if (this.detectPortScanning(connection)) {
            threats.push({
                type: 'PORT_SCANNING_DETECTED',
                risk_level: 'HIGH',
                description: 'Multiple rapid connection attempts detected'
            });
        }

        // Emit threats
        threats.forEach(threat => {
            this.emit('threat_detected', {
                ...threat,
                source: 'Network',
                data: connection,
                timestamp: new Date()
            });
        });
    }

    extractPort(address) {
        const match = address.match(/:(\d+)$/);
        return match ? parseInt(match[1]) : null;
    }

    extractIP(address) {
        const match = address.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
        return match ? match[1] : null;
    }

    detectPortScanning(connection) {
        const key = `${connection.remoteAddress}-${connection.pid}`;
        const now = Date.now();
        
        if (this.connectionCache.has(key)) {
            const lastTime = this.connectionCache.get(key);
            if (now - lastTime < 1000) { // Multiple connections within 1 second
                return true;
            }
        }
        
        this.connectionCache.set(key, now);
        
        // Clean old cache entries
        if (this.connectionCache.size > 1000) {
            const currentTime = Date.now();
            for (let [key, timestamp] of this.connectionCache.entries()) {
                if (currentTime - timestamp > 60000) { // Older than 1 minute
                    this.connectionCache.delete(key);
                }
            }
        }
        
        return false;
    }

    analyzeListeningPorts(output) {
        const lines = output.split('\n');
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 2) {
                const address = parts[1];
                const port = this.extractPort(address);
                
                if (port && this.suspiciousPorts.includes(port)) {
                    this.emit('threat_detected', {
                        type: 'SUSPICIOUS_LISTENING_PORT',
                        source: 'Network',
                        data: { address, port },
                        timestamp: new Date(),
                        risk_level: 'HIGH',
                        description: `Suspicious port ${port} listening for connections`
                    });
                }
            }
        });
    }

    analyzeDNSCache(output) {
        // Analyze DNS cache for suspicious domains
        const suspiciousDomains = ['malicious.com', 'evil.org', 'bad.net']; // Example domains
        
        suspiciousDomains.forEach(domain => {
            if (output.includes(domain)) {
                this.emit('threat_detected', {
                    type: 'SUSPICIOUS_DNS_QUERY',
                    source: 'Network',
                    data: { domain },
                    timestamp: new Date(),
                    risk_level: 'MEDIUM',
                    description: `DNS query for suspicious domain: ${domain}`
                });
            }
        });
    }

    analyzeDetailedConnections(connections) {
        // Store detailed connection information for behavioral analysis
        connections.forEach(connection => {
            dbClient.getCollection('network_connections').insertOne({
                ...connection,
                timestamp: new Date()
            }).catch(error => {
                winston.error('Error storing network connection:', error);
            });
        });
    }

    stopMonitoring() {
        this.isMonitoring = false;
        this.monitoringIntervals.forEach(interval => clearInterval(interval));
        this.monitoringIntervals = [];
        winston.info('Network log monitoring stopped');
    }
}

module.exports = NetworkLogMonitor;