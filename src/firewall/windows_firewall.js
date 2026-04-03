const { exec } = require('child_process');
const winston = require('winston');
const dbClient = require('../database/mongodb_client');

class WindowsFirewall {
    constructor() {
        this.isInitialized = false;
        this.activeRules = new Map();
    }

    async initialize() {
        try {
            // Load existing rules from database
            await this.loadExistingRules();
            
            this.isInitialized = true;
            winston.info('Windows Firewall manager initialized successfully');
        } catch (error) {
            winston.error('Error initializing Windows Firewall manager:', error);
            throw error;
        }
    }

    async loadExistingRules() {
        try {
            const rules = await dbClient.getCollection('firewall_rules')
                .find({ status: 'ACTIVE' })
                .toArray();

            rules.forEach(rule => {
                this.activeRules.set(rule.rule_id, rule);
            });

            winston.info(`Loaded ${rules.length} active firewall rules`);
        } catch (error) {
            winston.error('Error loading existing firewall rules:', error);
        }
    }

    async addRule(rule) {
        try {
            // Check if rule already exists
            if (this.activeRules.has(rule.rule_id)) {
                winston.warn(`Firewall rule already exists: ${rule.rule_id}`);
                return false;
            }

            // Execute the rule based on type
            let success = false;
            switch (rule.type) {
                case 'PROCESS_BLOCK':
                    success = await this.addProcessBlockRule(rule);
                    break;
                case 'NETWORK_BLOCK':
                    success = await this.addNetworkBlockRule(rule);
                    break;
                case 'SCRIPT_RESTRICTION':
                    success = await this.addScriptRestrictionRule(rule);
                    break;
                default:
                    success = await this.addGenericRule(rule);
            }

            if (success) {
                // Store rule in database
                await dbClient.getCollection('firewall_rules').insertOne({
                    ...rule,
                    status: 'ACTIVE',
                    created_at: new Date(),
                    last_updated: new Date()
                });

                this.activeRules.set(rule.rule_id, rule);
                winston.info(`Firewall rule added successfully: ${rule.rule_id}`);
                
                // Add to blockchain
                const blockchain = require('../core/blockchain');
                await blockchain.addFirewallRule(rule);
                
                return true;
            }

        } catch (error) {
            winston.error(`Error adding firewall rule ${rule.rule_id}:`, error);
        }

        return false;
    }

    async addProcessBlockRule(rule) {
        const processPath = rule.target;
        
        if (!processPath) {
            winston.error('Process path not specified for block rule');
            return false;
        }

        try {
            // Create Windows Firewall rule to block the process
            const command = `New-NetFirewallRule -DisplayName "BehavioralFW: ${rule.rule_id}" -Direction Outbound -Program "${processPath}" -Action Block -Profile Any`;
            
            await this.executePowerShellCommand(command);
            winston.info(`Process block rule created for: ${processPath}`);
            return true;

        } catch (error) {
            winston.error('Error creating process block rule:', error);
            return false;
        }
    }

    async addNetworkBlockRule(rule) {
        const targetIP = rule.target;
        const port = rule.port;

        try {
            let command;
            if (port) {
                command = `New-NetFirewallRule -DisplayName "BehavioralFW: ${rule.rule_id}" -Direction Outbound -RemoteAddress ${targetIP} -RemotePort ${port} -Protocol TCP -Action Block -Profile Any`;
            } else {
                command = `New-NetFirewallRule -DisplayName "BehavioralFW: ${rule.rule_id}" -Direction Outbound -RemoteAddress ${targetIP} -Action Block -Profile Any`;
            }

            await this.executePowerShellCommand(command);
            winston.info(`Network block rule created for: ${targetIP}${port ? ':' + port : ''}`);
            return true;

        } catch (error) {
            winston.error('Error creating network block rule:', error);
            return false;
        }
    }

    async addScriptRestrictionRule(rule) {
        // Implement PowerShell execution policy restrictions
        try {
            const commands = [
                'Set-ExecutionPolicy -ExecutionPolicy Restricted -Scope LocalMachine -Force',
                'Get-ChildItem -Path HKLM:SOFTWARE\\Microsoft\\PowerShell\\1\\ShellIds | ForEach-Object { Set-ItemProperty -Path $_.PSPath -Name ExecutionPolicy -Value "Restricted" }'
            ];

            for (const command of commands) {
                await this.executePowerShellCommand(command);
            }

            winston.info('PowerShell execution restrictions applied');
            return true;

        } catch (error) {
            winston.error('Error applying script restrictions:', error);
            return false;
        }
    }

    async addGenericRule(rule) {
        // Generic rule implementation
        winston.info(`Generic rule applied: ${rule.rule_id}`);
        return true;
    }

    async removeRule(ruleId) {
        try {
            const rule = this.activeRules.get(ruleId);
            if (!rule) {
                winston.warn(`Rule not found: ${ruleId}`);
                return false;
            }

            // Remove from Windows Firewall
            const command = `Remove-NetFirewallRule -DisplayName "BehavioralFW: ${ruleId}" -ErrorAction SilentlyContinue`;
            await this.executePowerShellCommand(command);

            // Update database
            await dbClient.getCollection('firewall_rules').updateOne(
                { rule_id: ruleId },
                { $set: { status: 'REMOVED', removed_at: new Date() } }
            );

            this.activeRules.delete(ruleId);
            winston.info(`Firewall rule removed: ${ruleId}`);
            return true;

        } catch (error) {
            winston.error(`Error removing firewall rule ${ruleId}:`, error);
            return false;
        }
    }

    async executePowerShellCommand(command) {
        return new Promise((resolve, reject) => {
            exec(`powershell -Command "${command}"`, { shell: 'powershell.exe' }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`PowerShell error: ${stderr || error.message}`));
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    async getActiveRules() {
        return Array.from(this.activeRules.values());
    }

    async getRuleStats() {
        const rules = await this.getActiveRules();
        
        const stats = {
            total: rules.length,
            byType: {},
            byPriority: {
                HIGH: 0,
                MEDIUM: 0,
                LOW: 0
            }
        };

        rules.forEach(rule => {
            // Count by type
            stats.byType[rule.type] = (stats.byType[rule.type] || 0) + 1;
            
            // Count by priority
            if (rule.priority) {
                stats.byPriority[rule.priority] = (stats.byPriority[rule.priority] || 0) + 1;
            }
        });

        return stats;
    }

    async cleanupOldRules() {
        try {
            // Remove rules older than 30 days
            const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            const oldRules = await dbClient.getCollection('firewall_rules')
                .find({ 
                    status: 'ACTIVE', 
                    created_at: { $lt: cutoffDate } 
                })
                .toArray();

            let removedCount = 0;
            for (const rule of oldRules) {
                const removed = await this.removeRule(rule.rule_id);
                if (removed) removedCount++;
            }

            winston.info(`Cleaned up ${removedCount} old firewall rules`);
            return removedCount;

        } catch (error) {
            winston.error('Error cleaning up old firewall rules:', error);
            return 0;
        }
    }

    async exportRules(format = 'json') {
        const rules = await this.getActiveRules();

        if (format === 'csv') {
            return this.convertRulesToCSV(rules);
        }

        return rules;
    }

    convertRulesToCSV(rules) {
        if (rules.length === 0) return '';
        
        const headers = ['Rule ID', 'Type', 'Target', 'Action', 'Priority', 'Created At', 'Description'];
        const rows = rules.map(rule => [
            rule.rule_id,
            rule.type,
            rule.target,
            rule.action,
            rule.priority,
            rule.created_at,
            rule.description
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n');
        
        return csv;
    }
}

module.exports = WindowsFirewall;