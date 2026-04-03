require('dotenv').config();
const BehavioralFirewall = require('./src/core/behavioral_firewall');
const winston = require('winston');
const fs = require('fs');

// Ensure logs directory exists
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs');
}

// Proper Winston configuration
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'behavioral-firewall' },
    transports: [
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 5242880,
            maxFiles: 5
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Global error handlers
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

async function startApplication() {
    try {
        logger.info('Starting Behavioral Firewall Application...');
        
        const firewall = new BehavioralFirewall();
        await firewall.start();
        
        logger.info('Behavioral Firewall started successfully');
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT. Shutting down gracefully...');
            await firewall.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM. Shutting down gracefully...');
            await firewall.stop();
            process.exit(0);
        });
        
    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

// Start the application
if (require.main === module) {
    startApplication();
}

module.exports = BehavioralFirewall;
