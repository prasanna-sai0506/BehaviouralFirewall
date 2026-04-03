const { exec } = require('child_process');
const EventEmitter = require('events');
const logger = require('winston'); // Update path as needed
const dbClient = require('../database/mongodb_client');

class ProcessMonitor extends EventEmitter {
    constructor() {
        super();
        this.isMonitoring = false;
        this.monitoringIntervals = [];
        this.processWhitelist = new Set();
        this.processBlacklist = new Set();
        this.suspiciousProcesses = new Set();
    }

    async startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        logger.info('Starting process monitoring...');

        try {
            await this.loadProcessLists();

            this.monitoringIntervals.push(
                setInterval(() => this.monitorRunningProcesses(), 5000),
                setInterval(() => this.monitorProcessCreation(), 3000),
                setInterval(() => this.monitorSuspiciousActivities(), 15000)
            );

            logger.info('Process monitoring started successfully');
        } catch (error) {
            logger.error('Failed to start process monitoring:', error);
            this.isMonitoring = false;
            throw error;
        }
    }

    async loadProcessLists() {
        try {
            // Load whitelist from database - FIXED: Added proper error handling
            const behavioralProfilesCollection = await dbClient.getCollection('behavioral_profiles');
            if (behavioralProfilesCollection) {
                const whitelist = await behavioralProfilesCollection.findOne({ node_id: 'process_whitelist' });
                
                if (whitelist && whitelist.whitelisted_processes) {
                    whitelist.whitelisted_processes.forEach(process => {
                        this.processWhitelist.add(process.toLowerCase());
                    });
                    winston.info(`Loaded ${this.processWhitelist.size} whitelisted processes`);
                }
            }

            // Load blacklist - FIXED: Added null checks and error handling
            const threatIntelligenceCollection = await dbClient.getCollection('threat_intelligence');
            if (threatIntelligenceCollection) {
                const blacklist = await threatIntelligenceCollection
                    .find({ type: 'MALICIOUS_PROCESS' })
                    .toArray();
                
                if (blacklist && blacklist.length > 0) {
                    blacklist.forEach(process => {
                        if (process.value) {
                            this.processBlacklist.add(process.value.toLowerCase());
                        }
                    });
                    winston.info(`Loaded ${this.processBlacklist.size} blacklisted processes`);
                }
            }

            // Known suspicious process patterns
            this.suspiciousProcesses = new Set([
                'mimikatz', 'cobaltstrike', 'metasploit', 'processhacker',
                'procexp', 'wireshark', 'netcat', 'nc', 'psexec'
            ]);

            winston.info('Process lists loaded successfully');

        } catch (error) {
            winston.error('Error loading process lists:', error);
            throw error; // Re-throw to handle in startMonitoring
        }
    }

    async monitorRunningProcesses() {
        if (!this.isMonitoring) return;

        const command = `Get-Process | Select-Object Name, Path, Id, CPU, WorkingSet, StartTime | ConvertTo-Json`;
        
        exec(`powershell "${command}"`, { shell: 'powershell.exe' }, (error, stdout) => {
            if (error) {
                winston.error('Error getting processes:', error);
                return;
            }

            if (stdout && stdout.trim()) {
                try {
                    const processes = JSON.parse(stdout);
                    this.analyzeProcesses(Array.isArray(processes) ? processes : [processes]);
                } catch (parseError) {
                    winston.error('Error parsing processes:', parseError);
                }
            }
        });
    }

    async monitorProcessCreation() {
        if (!this.isMonitoring) return;

        try {
            // Use WMI to monitor process creation
            const wmiDate = this.getWMIDate(new Date(Date.now() - 10000));
            const command = `Get-WmiObject Win32_Process -Filter "CreationDate >= '${wmiDate}'" | Select-Object Name, ProcessId, CommandLine, CreationDate | ConvertTo-Json`;
            
            exec(`powershell "${command}"`, { shell: 'powershell.exe' }, (error, stdout) => {
                if (error) {
                    // Don't log error if no new processes found (common case)
                    if (!error.message.includes('No matching processes')) {
                        winston.debug('Error getting new processes:', error);
                    }
                    return;
                }

                if (stdout && stdout.trim()) {
                    try {
                        const newProcesses = JSON.parse(stdout);
                        this.analyzeNewProcesses(Array.isArray(newProcesses) ? newProcesses : [newProcesses]);
                    } catch (parseError) {
                        winston.error('Error parsing new processes:', parseError);
                    }
                }
            });
        } catch (error) {
            winston.error('Error in process creation monitoring:', error);
        }
    }

    monitorSuspiciousActivities() {
        if (!this.isMonitoring) return;
        
        try {
            this.checkForSuspiciousProcessBehavior();
        } catch (error) {
            winston.error('Error in suspicious activities monitoring:', error);
        }
    }

    analyzeProcesses(processes) {
        if (!processes || !Array.isArray(processes)) return;

        processes.forEach(process => {
            if (!process || !process.Name) return;

            const processName = process.Name.toLowerCase();
            const processPath = process.Path || '';

            // Check against blacklist
            if (this.processBlacklist.has(processName)) {
                this.emitProcessAlert('BLACKLISTED_PROCESS', process, 'HIGH');
                return;
            }

            // Check for suspicious process names
            for (const suspicious of this.suspiciousProcesses) {
                if (processName.includes(suspicious)) {
                    this.emitProcessAlert('SUSPICIOUS_PROCESS_NAME', process, 'HIGH');
                    break;
                }
            }

            // Check for processes in unusual locations
            if (processPath && this.isSuspiciousLocation(processPath)) {
                this.emitProcessAlert('SUSPICIOUS_PROCESS_LOCATION', process, 'MEDIUM');
            }

            // Check for unknown processes (not in whitelist)
            if (this.processWhitelist.size > 0 && !this.processWhitelist.has(processName)) {
                this.emitProcessAlert('UNKNOWN_PROCESS', process, 'LOW');
            }
        });
    }

    analyzeNewProcesses(processes) {
        if (!processes || !Array.isArray(processes)) return;

        processes.forEach(process => {
            if (!process || !process.Name) return;

            const processName = process.Name.toLowerCase();
            const commandLine = process.CommandLine || '';

            // Analyze command line for suspicious patterns
            if (this.hasSuspiciousCommandLine(commandLine)) {
                this.emitProcessAlert('SUSPICIOUS_COMMAND_LINE', process, 'HIGH');
            }

            // Check for living-off-the-land binaries (LOLBins) abuse
            if (this.isLOLBinAbuse(processName, commandLine)) {
                this.emitProcessAlert('LOLBIN_ABUSE', process, 'HIGH');
            }
        });
    }

    emitProcessAlert(type, process, riskLevel) {
        try {
            const alert = {
                type: type,
                source: 'Process',
                data: process,
                timestamp: new Date(),
                risk_level: riskLevel,
                description: this.getAlertDescription(type, process)
            };

            this.emit('process_alert', alert);
            winston.info(`Process alert emitted: ${type} - ${process.Name}`);
        } catch (error) {
            winston.error('Error emitting process alert:', error);
        }
    }

    getAlertDescription(type, process) {
        const descriptions = {
            'BLACKLISTED_PROCESS': `Blacklisted process detected: ${process.Name}`,
            'SUSPICIOUS_PROCESS_NAME': `Suspicious process name: ${process.Name}`,
            'SUSPICIOUS_PROCESS_LOCATION': `Process running from suspicious location: ${process.Path}`,
            'UNKNOWN_PROCESS': `Unknown process detected: ${process.Name}`,
            'SUSPICIOUS_COMMAND_LINE': `Suspicious command line arguments in process: ${process.Name}`,
            'LOLBIN_ABUSE': `Potential LOLBin abuse detected: ${process.Name}`
        };

        return descriptions[type] || `Process alert: ${type}`;
    }

    isSuspiciousLocation(path) {
        if (!path) return false;

        const suspiciousPaths = [
            '\\temp\\',
            '\\tmp\\',
            '\\appdata\\',
            '\\users\\',
            '\\recycle\\',
            '\\windows\\temp\\'
        ];

        const lowerPath = path.toLowerCase();
        return suspiciousPaths.some(suspicious => lowerPath.includes(suspicious));
    }

    hasSuspiciousCommandLine(commandLine) {
        if (!commandLine) return false;

        const suspiciousPatterns = [
            '/c certutil',
            'Invoke-Expression',
            'DownloadString',
            'FromBase64String',
            'IEX ',
            'powershell -encodedcommand',
            'cmd /c powershell',
            'reg add',
            'schtasks /create',
            'wmic process call create'
        ];

        const lowerCommandLine = commandLine.toLowerCase();
        return suspiciousPatterns.some(pattern => lowerCommandLine.includes(pattern.toLowerCase()));
    }

    isLOLBinAbuse(processName, commandLine) {
        const lolBins = {
            'certutil': ['urlcache', 'encode', 'decode'],
            'bitsadmin': ['transfer', '/addfile'],
            'mshta': ['http', 'javascript'],
            'rundll32': ['javascript', 'vbscript'],
            'regsvr32': ['/i:http', 'scrobj.dll']
        };

        if (lolBins[processName]) {
            const lowerCommandLine = commandLine.toLowerCase();
            return lolBins[processName].some(param => lowerCommandLine.includes(param));
        }

        return false;
    }

    checkForSuspiciousProcessBehavior() {
        // Check for process injection, code injection, etc.
        // This would require more advanced monitoring techniques
        // Placeholder for future implementation
    }

    getWMIDate(date) {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + '000000+***';
    }

    stopMonitoring() {
        this.isMonitoring = false;
        this.monitoringIntervals.forEach(interval => clearInterval(interval));
        this.monitoringIntervals = [];
        winston.info('Process monitoring stopped');
    }
}

module.exports = ProcessMonitor;