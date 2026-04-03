// Additional chart configurations and utilities
class ChartManager {
    constructor() {
        this.charts = {};
    }

    createThreatTimelineChart(canvasId, data) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        this.charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    label: 'Threats per Hour',
                    data: Object.values(data).map(item => item.count),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1e293b',
                        titleColor: '#e2e8f0',
                        bodyColor: '#cbd5e1'
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#374151'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        grid: {
                            color: '#374151'
                        },
                        ticks: {
                            color: '#94a3b8'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    createNetworkActivityChart(canvasId, data) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        this.charts.network = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item._id),
                datasets: [{
                    label: 'Network Threats',
                    data: data.map(item => item.count),
                    backgroundColor: '#3b82f6',
                    borderColor: '#2563eb',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#374151'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        grid: {
                            color: '#374151'
                        },
                        ticks: {
                            color: '#94a3b8'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    destroyChart(name) {
        if (this.charts[name]) {
            this.charts[name].destroy();
            delete this.charts[name];
        }
    }

    destroyAllCharts() {
        Object.keys(this.charts).forEach(name => {
            this.destroyChart(name);
        });
    }
}

// Initialize chart manager
window.chartManager = new ChartManager();