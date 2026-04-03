const { exec } = require('child_process');
const EventEmitter = require('events');
const winston = require('winston');
const dbClient = require('../database/mongodb_client');

class SystemLogMonitor extends EventEmitter {
    constructor() {
        super();
        this.isMonitoring = false;
        this.monitoringIntervals = [];
        this.lastEventIds = new Map();
    }

    async startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        winston.info('Starting system log monitoring...');

        // Start monitoring different log types
        this.monitoringIntervals.push(
            this.monitorSecurityLogs(),
            this.monitorSystemLogs(),
            this.monitorApplicationLogs(),
            this.monitorPowerShellLogs()
        );

        winston.info('System log monitoring started successfully');
    }

    monitorSecurityLogs() {
        return setInterval(() => {
            const command = `Get-WinEvent -FilterHashtable @{LogName="Security"; StartTime=(Get-Date).AddMinutes(-2)} -MaxEvents 10 | Select-Object TimeCreated, Id, LevelDisplayName, Message | ConvertTo-Json`;
            
            exec(`powershell "${command}"`, { shell: 'powershell.exe' }, (error, stdout) => {
                if (error) {
                    winston.error('Error reading security logs:', error);
                    return;
                }

                if (stdout && stdout.trim()) {
                    try {
                        const events = JSON.parse(stdout);
                        this.processSecurityEvents(Array.isArray(events) ? events : [events]);
                    } catch (parseError) {
                        winston.error('Error parsing security events:', parseError);
                    }
                }
            });
        }, 5000);
    }

    monitorSystemLogs() {
        return setInterval(() => {
            const command = `Get-WinEvent -FilterHashtable @{LogName="System"; Level=1,2,3; StartTime=(Get-Date).AddMinutes(-2)} -MaxEvents 5 | Select-Object TimeCreated, Id, LevelDisplayName, Message | ConvertTo-Json`;
            
            exec(`powershell "${command}"`, { shell: 'powershell.exe' }, (error, stdout) => {
                if (!error && stdout) {
                    try {
                        const events = JSON.parse(stdout);
                        this.processSystemEvents(Array.isArray(events) ? events : [events]);
                    } catch (parseError) {
                        winston.error('Error parsing system events:', parseError);
                    }
                }
            });
        }, 10000);
    }

    monitorApplicationLogs() {
        return setInterval(() => {
            const command = `Get-WinEvent -FilterHashtable @{LogName="Application"; Level=1,2,3; StartTime=(Get-Date).AddMinutes(-2)} -MaxEvents 5 | Select-Object TimeCreated, Id, LevelDisplayName, Message | ConvertTo-Json`;
            
            exec(`powershell "${command}"`, { shell: 'powershell.exe' }, (error, stdout) => {
                if (!error && stdout) {
                    try {
                        const events = JSON.parse(stdout);
                        this.processApplicationEvents(Array.isArray(events) ? events : [events]);
                    } catch (parseError) {
                        winston.error('Error parsing application events:', parseError);
                    }
                }
            });
        }, 15000);
    }

    monitorPowerShellLogs() {
        return setInterval(() => {
            const command = `Get-WinEvent -FilterHashtable @{LogName="Microsoft-Windows-PowerShell/Operational"; StartTime=(Get-Date).AddMinutes(-2)} -MaxEvents 5 | Select-Object TimeCreated, Id, LevelDisplayName, Message | ConvertTo-Json`;
            
            exec(`powershell "${command}"`, { shell: 'powershell.exe' }, (error, stdout) => {
                if (!error && stdout) {
                    try {
                        const events = JSON.parse(stdout);
                        this.processPowerShellEvents(Array.isArray(events) ? events : [events]);
                    } catch (parseError) {
                        winston.error('Error parsing PowerShell events:', parseError);
                    }
                }
            });
        }, 20000);
    }

    processSecurityEvents(events) {
        events.forEach(event => {
            const eventId = event.Id;
            const lastId = this.lastEventIds.get('security') || 0;

            if (eventId > lastId) {
                this.lastEventIds.set('security', eventId);

                let eventType = 'SECURITY_EVENT';
                let riskLevel = 'LOW';

                // Analyze event type
                if (event.Id === 4624) { // Successful logon
                    eventType = 'LOGON_SUCCESS';
                    riskLevel = 'LOW';
                } else if (event.Id === 4625) { // Failed logon
                    eventType = 'LOGON_FAILURE';
                    riskLevel = 'MEDIUM';
                } else if (event.Id === 4672) { // Special privileges
                    eventType = 'PRIVILEGE_ESCALATION';
                    riskLevel = 'HIGH';
                } else if (event.Id === 4732) { // User added to group
                    eventType = 'GROUP_MEMBERSHIP_CHANGE';
                    riskLevel = 'MEDIUM';
                }

                const securityEvent = {
                    type: eventType,
                    source: 'Security',
                    data: event,
                    timestamp: new Date(event.TimeCreated),
                    risk_level: riskLevel,
                    event_id: event.Id
                };

                this.emit('event', securityEvent);
            }
        });
    }

    processSystemEvents(events) {
        events.forEach(event => {
            const eventType = this.analyzeSystemEvent(event);
            if (eventType) {
                const systemEvent = {
                    type: eventType,
                    source: 'System',
                    data: event,
                    timestamp: new Date(event.TimeCreated),
                    risk_level: 'MEDIUM'
                };

                this.emit('event', systemEvent);
            }
        });
    }

    analyzeSystemEvent(event) {
        const message = event.Message || '';
        
        if (message.includes('Service Control Manager') && message.includes('stopped')) {
            return 'SERVICE_STOPPED';
        }
        
        if (message.includes('The system has rebooted without cleanly shutting down first')) {
            return 'UNEXPECTED_SHUTDOWN';
        }
        
        if (message.includes('The time provider NtpClient')) {
            return 'TIME_SYNC_ISSUE';
        }

        return null;
    }

    processApplicationEvents(events) {
        events.forEach(event => {
            if (event.LevelDisplayName === 'Error' || event.LevelDisplayName === 'Warning') {
                const appEvent = {
                    type: 'APPLICATION_ERROR',
                    source: 'Application',
                    data: event,
                    timestamp: new Date(event.TimeCreated),
                    risk_level: 'LOW'
                };

                this.emit('event', appEvent);
            }
        });
    }

    processPowerShellEvents(events) {
        events.forEach(event => {
            const message = event.Message || '';
            
            // Detect suspicious PowerShell activity
            if (message.includes('ScriptBlockText') && 
                (message.includes('Invoke-Expression') || 
                 message.includes('DownloadString') ||
                 message.includes('Base64'))) {
                
                const psEvent = {
                    type: 'SUSPICIOUS_POWERSHELL',
                    source: 'PowerShell',
                    data: event,
                    timestamp: new Date(event.TimeCreated),
                    risk_level: 'HIGH'
                };

                this.emit('event', psEvent);
            }
        });
    }

    stopMonitoring() {
        this.isMonitoring = false;
        this.monitoringIntervals.forEach(interval => clearInterval(interval));
        this.monitoringIntervals = [];
        winston.info('System log monitoring stopped');
    }
}

module.exports = SystemLogMonitor;