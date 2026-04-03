// Real-time data handling and WebSocket management
class RealTimeManager {
    constructor() {
        this.socket = io();
        this.connectionStatus = 'connecting';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }

    init() {
        this.setupSocketListeners();
        this.setupConnectionMonitoring();
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.connectionStatus = 'connected';
            this.reconnectAttempts = 0;
            this.updateConnectionStatus();
            console.log('WebSocket connected');
        });

        this.socket.on('disconnect', () => {
            this.connectionStatus = 'disconnected';
            this.updateConnectionStatus();
            console.log('WebSocket disconnected');
        });

        this.socket.on('reconnect_attempt', (attempt) => {
            this.connectionStatus = 'reconnecting';
            this.reconnectAttempts = attempt;
            this.updateConnectionStatus();
            console.log(`WebSocket reconnect attempt ${attempt}`);
        });

        this.socket.on('reconnect_failed', () => {
            this.connectionStatus = 'failed';
            this.updateConnectionStatus();
            console.error('WebSocket reconnection failed');
        });

        // Custom events
        this.socket.on('system_alert', (alert) => {
            this.handleSystemAlert(alert);
        });

        this.socket.on('performance_metrics', (metrics) => {
            this.updatePerformanceMetrics(metrics);
        });
    }

    setupConnectionMonitoring() {
        // Monitor connection health
        setInterval(() => {
            if (this.socket.connected) {
                this.socket.emit('ping', { timestamp: Date.now() });
            }
        }, 30000);
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        const statusConfig = {
            connected: { text: 'Connected', class: 'online' },
            connecting: { text: 'Connecting...', class: 'warning' },
            reconnecting: { text: 'Reconnecting...', class: 'warning' },
            disconnected: { text: 'Disconnected', class: 'offline' },
            failed: { text: 'Connection Failed', class: 'offline' }
        };

        const config = statusConfig[this.connectionStatus] || statusConfig.connecting;
        
        statusElement.innerHTML = `
            <span class="status-indicator ${config.class}"></span>
            <span>${config.text}</span>
            ${this.reconnectAttempts > 0 ? `<span class="reconnect-attempts">(${this.reconnectAttempts})</span>` : ''}
        `;
    }

    handleSystemAlert(alert) {
        const dashboard = window.dashboard;
        if (dashboard) {
            dashboard.showNotification(alert.message, alert.level);
        }

        // Additional alert handling logic
        this.logAlert(alert);
        this.updateAlertStatistics(alert);
    }

    updatePerformanceMetrics(metrics) {
        // Update performance metrics display
        const metricsElement = document.getElementById('performanceMetrics');
        if (metricsElement) {
            metricsElement.innerHTML = `
                <div class="metric-item">
                    <span class="metric-label">CPU:</span>
                    <span class="metric-value">${metrics.cpu.toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Memory:</span>
                    <span class="metric-value">${metrics.memory.toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Network:</span>
                    <span class="metric-value">${metrics.network} req/s</span>
                </div>
            `;
        }
    }

    logAlert(alert) {
        // Log alert to console or external service
        console.log('System Alert:', alert);
    }

    updateAlertStatistics(alert) {
        // Update alert statistics
        // This could update counters, charts, etc.
    }

    // Method to manually reconnect
    reconnect() {
        if (this.socket) {
            this.socket.connect();
        }
    }

    // Method to disconnect
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Initialize real-time manager
window.realTimeManager = new RealTimeManager();