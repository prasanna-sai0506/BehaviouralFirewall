const { MongoClient, ServerApiVersion } = require('mongodb');
const winston = require('winston');

class MongoDBClient {
    constructor() {
        this.uri = process.env.MONGODB_URI || "mongodb://localhost:27017/behavioral_firewall";
        this.client = new MongoClient(this.uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });
        this.db = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            await this.client.connect();
            this.db = this.client.db();
            this.isConnected = true;
            
            await this.createCollections();
            await this.createIndexes();
            
            winston.info('MongoDB connected successfully');
            return true;
        } catch (error) {
            winston.error('MongoDB connection failed:', error);
            return false;
        }
    }

    async createCollections() {
        const collections = [
            'behavioral_profiles',
            'firewall_rules', 
            'threat_events',
            'blockchain_ledger',
            'security_events',
            'system_metrics',
            'network_connections'
        ];

        for (const collectionName of collections) {
            const collections = await this.db.listCollections({ name: collectionName }).toArray();
            if (collections.length === 0) {
                await this.db.createCollection(collectionName);
                winston.info(`Created collection: ${collectionName}`);
            }
        }
    }

    async createIndexes() {
        // Behavioral profiles indexes
        await this.db.collection('behavioral_profiles').createIndex({ node_id: 1 }, { unique: true });
        await this.db.collection('behavioral_profiles').createIndex({ last_updated: -1 });

        // Threat events indexes
        await this.db.collection('threat_events').createIndex({ timestamp: -1 });
        await this.db.collection('threat_events').createIndex({ type: 1 });
        await this.db.collection('threat_events').createIndex({ threat_score: -1 });
        await this.db.collection('threat_events').createIndex({ source: 1 });

        // Blockchain indexes
        await this.db.collection('blockchain_ledger').createIndex({ index: 1 }, { unique: true });
        await this.db.collection('blockchain_ledger').createIndex({ timestamp: -1 });
        await this.db.collection('blockchain_ledger').createIndex({ hash: 1 });

        // Security events indexes
        await this.db.collection('security_events').createIndex({ timestamp: -1 });
        await this.db.collection('security_events').createIndex({ processed: 1 });

        winston.info('Database indexes created successfully');
    }

    getCollection(name) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }
        return this.db.collection(name);
    }

    async disconnect() {
        try {
            await this.client.close();
            this.isConnected = false;
            winston.info('MongoDB disconnected successfully');
        } catch (error) {
            winston.error('Error disconnecting from MongoDB:', error);
        }
    }

    async healthCheck() {
        try {
            await this.db.command({ ping: 1 });
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new MongoDBClient();