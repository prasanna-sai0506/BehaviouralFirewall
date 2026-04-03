class Dashboard {
    constructor() {
        this.socket = io();
        this.currentData = null;
        this.charts = {};
        this.currentPage = 1;
        this.currentFilters = {
            type: '',
            risk_level: ''
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupSocketListeners();
        this.loadInitialData();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Refresh buttons
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadInitialData();
        });

        document.getElementById('refreshTable').addEventListener('click', () => {
            this.loadThreatsTable();
        });

        document.getElementById('refreshChart').addEventListener('click', () => {
            this.refreshCharts();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.debouncedSearch(e.target.value);
        });

        // Filter functionality
        document.getElementById('typeFilter').addEventListener('change', (e) => {
            this.currentFilters.type = e.target.value;
            this.loadThreatsTable();
        });

        document.getElementById('riskFilter').addEventListener('change', (e) => {
            this.currentFilters.risk_level = e.target.value;
            this.loadThreatsTable();
        });

        // Pagination
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-btn')) {
                const page = parseInt(e.target.dataset.page);
                this.changePage(page);
            }
        });
    }

    setupSocketListeners() {
        this.socket.on('initial_data', (data) => {
            this.currentData = data;
            this.updateDashboard(data);
        });

        this.socket.on('realtime_update', (data) => {
            this.updateRealTimeData(data);
        });

        this.socket.on('new_threat', (threat) => {
            this.addNewThreat(threat);
        });

        this.socket.on('search_results', (results) => {
            this.displaySearchResults(results);
        });

        this.socket.on('error', (error) => {
            this.showNotification(error.message, 'error');
        });
    }

    async loadInitialData() {
        try {
            this.showLoadingState();
            
            const [threatsResponse, systemHealth] = await Promise.all([
                fetch('/api/threats?limit=50'),
                fetch('/api/system/health')
            ]);

            const threatsData = await threatsResponse.json();
            const healthData = await systemHealth.json();

            this.updateThreatsTable(threatsData.threats);
            this.updatePagination(threatsData.pagination);
            this.updateSystemStatus(healthData);

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Failed to load data', 'error');
        }
    }

    async loadThreatsTable() {
        try {
            const queryParams = new URLSearchParams({
                page: this.currentPage,
                limit: 50,
                ...this.currentFilters
            });

            const response = await fetch(`/api/threats?${queryParams}`);
            const data = await response.json();

            this.updateThreatsTable(data.threats);
            this.updatePagination(data.pagination);

        } catch (error) {
            console.error('Error loading threats table:', error);
            this.showNotification('Failed to load threats', 'error');
        }
    }

    updateDashboard(data) {
        this.updateStatsCards(data.systemStats);
        this.updateThreatsTable(data.recentThreats);
        this.initCharts(data);
        this.updateSystemStatus(data);
    }

    updateStatsCards(stats) {
        document.getElementById('totalThreats').textContent = 
            this.formatNumber(stats.totalThreats);
        document.getElementById('highThreats').textContent = 
            this.formatNumber(stats.highThreats);
        document.getElementById('blockchainBlocks').textContent = 
            this.formatNumber(stats.blockchainStats?.totalBlocks || 0);
        document.getElementById('firewallRules').textContent = 
            this.formatNumber(stats.firewallStats?.total || 0);
    }

    updateThreatsTable(threats) {
        const tbody = document.getElementById('threatTableBody');
        
        if (threats.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="loading-cell">
                        <i class="fas fa-search"></i>
                        No threats found matching current filters
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = threats.map(threat => `
            <tr>
                <td>${this.formatDate(threat.timestamp)}</td>
                <td>
                    <div class="threat-type">${threat.type}</div>
                    <div class="threat-time">${this.formatTime(threat.timestamp)}</div>
                </td>
                <td>${threat.source}</td>
                <td>
                    <span class="risk-badge risk-${threat.risk_level?.toLowerCase() || 'medium'}">
                        ${threat.risk_level || 'MEDIUM'}
                    </span>
                </td>
                <td>
                    <div class="score-container">
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${threat.threat_score || 0}%"></div>
                        </div>
                        <span class="score-value">${Math.round(threat.threat_score || 0)}</span>
                    </div>
                </td>
                <td>${threat.description || 'No description available'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-secondary" onclick="dashboard.viewThreatDetails('${threat._id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="dashboard.blockThreat('${threat._id}')">
                            <i class="fas fa-ban"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updateRealTimeData(data) {
        this.updateRealTimeThreats(data.currentThreats);
        this.updateSystemHealth(data.systemHealth);
        this.updateActiveConnections(data.activeConnections);
    }

    updateRealTimeThreats(threats) {
        const container = document.getElementById('realtimeThreats');
        const countBadge = document.getElementById('realtimeCount');
        
        countBadge.textContent = threats.length;

        if (threats.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shield-alt"></i>
                    <p>No recent threats detected</p>
                </div>
            `;
            return;
        }

        container.innerHTML = threats.map(threat => `
            <div class="threat-item ${threat.risk_level?.toLowerCase() || 'medium'}">
                <div class="threat-header">
                    <span class="threat-type">${threat.type}</span>
                    <span class="threat-time">${this.formatTime(threat.timestamp)}</span>
                </div>
                <div class="threat-description">${threat.description || 'No description'}</div>
                <div class="threat-score">Score: ${Math.round(threat.threat_score || 0)}</div>
            </div>
        `).join('');
    }

    addNewThreat(threat) {
        // Add to real-time list
        const currentThreats = this.currentData?.currentThreats || [];
        const updatedThreats = [threat, ...currentThreats].slice(0, 10);
        this.updateRealTimeThreats(updatedThreats);
        
        // Reload table if on first page
        if (this.currentPage === 1) {
            this.loadThreatsTable();
        }
        
        // Show notification
        this.showNotification(
            `New ${threat.risk_level?.toLowerCase()} threat: ${threat.type}`,
            threat.risk_level?.toLowerCase() || 'medium'
        );
    }

    updateSystemStatus(healthData) {
        const systemStatus = document.getElementById('systemStatus');
        const systemStatusText = document.getElementById('systemStatusText');
        const dbStatus = document.getElementById('dbStatus');
        const dbStatusText = document.getElementById('dbStatusText');
        const blockchainStatus = document.getElementById('blockchainStatus');
        const blockchainStatusText = document.getElementById('blockchainStatusText');

        // Update status indicators
        if (healthData.system?.mongodb) {
            dbStatus.className = 'status-indicator online';
            dbStatusText.textContent = 'Connected';
        } else {
            dbStatus.className = 'status-indicator offline';
            dbStatusText.textContent = 'Disconnected';
        }

        if (healthData.system?.blockchain) {
            blockchainStatus.className = 'status-indicator online';
            blockchainStatusText.textContent = 'Valid';
        } else {
            blockchainStatus.className = 'status-indicator warning';
            blockchainStatusText.textContent = 'Issues';
        }

        systemStatus.className = 'status-indicator online';
        systemStatusText.textContent = 'Running';
    }

    updateSystemHealth(healthData) {
        // Update system health indicators
        // This could be extended to show CPU, memory usage, etc.
    }

    updateActiveConnections(connections) {
        // Update active connections display
    }

    updatePagination(pagination) {
        const container = document.getElementById('pagination');
        
        if (!pagination || pagination.pages <= 1) {
            container.innerHTML = '';
            return;
        }

        const { page, pages, total } = pagination;
        
        let paginationHTML = `
            <div class="pagination-info">
                Showing page ${page} of ${pages} (${total} total items)
            </div>
            <div class="pagination-controls">
        `;

        // Previous button
        if (page > 1) {
            paginationHTML += `<button class="pagination-btn page-btn" data-page="${page - 1}">Previous</button>`;
        }

        // Page numbers
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(pages, page + 2);

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === page ? 'active' : '';
            paginationHTML += `<button class="pagination-btn page-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }

        // Next button
        if (page < pages) {
            paginationHTML += `<button class="pagination-btn page-btn" data-page="${page + 1}">Next</button>`;
        }

        paginationHTML += `</div>`;
        container.innerHTML = paginationHTML;
    }

    changePage(page) {
        this.currentPage = page;
        this.loadThreatsTable();
    }

    async searchThreats(query) {
        if (!query || query.length < 2) {
            this.loadThreatsTable();
            return;
        }

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const results = await response.json();
            
            this.displaySearchResults(results);

        } catch (error) {
            console.error('Error searching threats:', error);
            this.showNotification('Search failed', 'error');
        }
    }

    displaySearchResults(results) {
        this.updateThreatsTable(results.threats);
        // Could also display blockchain results if needed
    }

    async exportData() {
        try {
            const response = await fetch('/api/export?format=csv&type=threats');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `threats_export_${this.formatDateForFile()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            this.showNotification('Export started successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Export failed', 'error');
        }
    }

    viewThreatDetails(threatId) {
        // Implement threat details modal
        this.showNotification('Threat details feature coming soon', 'info');
    }

    async blockThreat(threatId) {
        if (confirm('Are you sure you want to block this threat?')) {
            try {
                // This would call an API endpoint to block the threat
                this.showNotification('Threat blocking feature coming soon', 'info');
            } catch (error) {
                console.error('Error blocking threat:', error);
                this.showNotification('Failed to block threat', 'error');
            }
        }
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            info: 'fas fa-info-circle',
            success: 'fas fa-check-circle',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-exclamation-circle',
            high: 'fas fa-skull-crossbones',
            medium: 'fas fa-exclamation-triangle',
            low: 'fas fa-info-circle'
        };

        notification.innerHTML = `
            <div class="notification-content">
                <i class="${icons[type] || icons.info}"></i>
                <div>
                    <div class="notification-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                    <div class="notification-message">${message}</div>
                </div>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        container.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    showLoadingState() {
        const tbody = document.getElementById('threatTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-cell">
                    <i class="fas fa-spinner fa-spin"></i>
                    Loading threats...
                </td>
            </tr>
        `;
    }

    initCharts(data) {
        this.initThreatDistributionChart(data.systemStats.threatsByType);
        this.initThreatTimelineChart(data.systemStats.threatsByHour);
    }

    refreshCharts() {
        if (this.currentData) {
            this.initCharts(this.currentData);
        }
    }

    initThreatDistributionChart(threatsByType) {
        const ctx = document.getElementById('threatChart').getContext('2d');
        
        if (this.charts.threatDistribution) {
            this.charts.threatDistribution.destroy();
        }

        const labels = Object.keys(threatsByType);
        const data = Object.values(threatsByType);

        this.charts.threatDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6',
                        '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
                    ],
                    borderWidth: 2,
                    borderColor: '#1e293b'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#e2e8f0',
                            font: {
                                size: 11
                            },
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#e2e8f0',
                        bodyColor: '#cbd5e1',
                        borderColor: '#374151',
                        borderWidth: 1
                    }
                },
                cutout: '60%'
            }
        });
    }

    initThreatTimelineChart(threatsByHour) {
        // This would create a timeline chart of threats by hour
        // Implementation depends on specific chart requirements
    }

    startAutoRefresh() {
        // Auto-refresh data every 30 seconds
        setInterval(() => {
            this.loadInitialData();
        }, 30000);
    }

    // Utility functions
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
    }

    formatTime(dateString) {
        return new Date(dateString).toLocaleTimeString();
    }

    formatDateForFile() {
        return new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    get debouncedSearch() {
        return this.debounce((query) => this.searchThreats(query), 300);
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
});