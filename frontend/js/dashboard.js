let threatChart, severityChart;

async function initDashboard() {
    await fetchSummary();
    await fetchTimeline();
    await fetchSeverityDist();
    await fetchRecentThreats();
}

async function fetchSummary() {
    const res = await api.get('/dashboard/summary');
    if (res && res.success) {
        document.getElementById('stat-total-threats').innerText = res.data.total_threats;
        document.getElementById('stat-blocked-ips').innerText = res.data.blocked_ips;
        document.getElementById('stat-blockchain-height').innerText = res.data.blockchain_length;
    }
}

async function fetchRecentThreats() {
    const res = await api.get('/threats?limit=10');
    if (res && res.success) {
        const tbody = document.querySelector('#threat-feed tbody');
        tbody.innerHTML = '';
        res.data.forEach(renderThreatRow);
    }
}

function renderThreatRow(threat) {
    const tbody = document.querySelector('#threat-feed tbody');
    const row = document.createElement('tr');
    row.id = `threat-${threat._id}`;
    
    const severityStr = String(threat.severity || 'low');
    const severityClass = `severity-${severityStr.toLowerCase()}`;
    const date = new Date(threat.timestamp).toLocaleTimeString();
    
    row.innerHTML = `
        <td>${date}</td>
        <td><code>${threat.source_ip}</code></td>
        <td>${threat.threat_type.replace('_', ' ')}</td>
        <td class="${severityClass}">${severityStr.toUpperCase()}</td>
        <td>${(threat.ml_confidence * 100).toFixed(1)}%</td>
        <td>
            <button class="btn btn-danger" onclick="blockIP('${threat._id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">BLOCK</button>
        </td>
    `;
    
    tbody.prepend(row);
}

window.updateThreatFeed = function(threat) {
    renderThreatRow(threat);
    // Remove if more than 10
    const tbody = document.querySelector('#threat-feed tbody');
    if (tbody.children.length > 10) {
        tbody.removeChild(tbody.lastChild);
    }
    // Update summary
    fetchSummary();
};

window.updateLogAudit = function(event) {
    const container = document.getElementById('log-audit-feed');
    const entry = document.createElement('div');
    entry.style.padding = '4px 8px';
    entry.style.borderLeft = event.is_threat ? '2px solid var(--danger)' : '2px solid #222';
    
    const time = new Date().toLocaleTimeString();
    const typeColor = event.is_threat ? 'var(--danger)' : 'var(--success)';
    const typeLabel = event.is_threat ? '[THREAT]' : '[NORMAL]';
    
    entry.innerHTML = `
        <span style="opacity: 0.4;">${time}</span> 
        <span style="color: ${typeColor}; font-weight: bold;">${typeLabel}</span>
        <span style="opacity: 0.8;">${event.raw.content || event.raw}</span>
        <span style="float: right; font-size: 9px; opacity: 0.3; text-transform: uppercase;">✔ Audited</span>
    `;
    
    container.prepend(entry);
    if (container.children.length > 50) {
        container.removeChild(container.lastChild);
    }
    
    // Update live counters based on category
    let cat = event.raw?.category || 'general';
    // Map general to system if UI doesn't have a general slot
    if (cat === 'general') cat = 'system';
    
    const countEl = document.getElementById(`stat-count-${cat}`);
    if (countEl) {
        const current = parseInt(countEl.innerText);
        countEl.innerText = current + 1;
        
        // Visual ping
        const statusText = document.getElementById(`status-text-${cat}`);
        if (statusText) {
            const original = statusText.innerText;
            statusText.innerText = ">>> PROCESSING EVENT";
            statusText.style.color = "var(--primary)";
            setTimeout(() => {
                statusText.innerText = original;
                statusText.style.color = "";
            }, 500);
        }
    }

    document.getElementById('audit-sync-status').innerHTML = `
        <div style="width: 5px; height: 5px; background: var(--success); border-radius: 50%;" class="pulse"></div>
        LIVE ANALYSING...
    `;
};

window.updateBlockchainStats = function(data) {
    document.getElementById('stat-blockchain-height').innerText = data.block_count;
    document.getElementById('audit-block-count').innerText = data.block_count;
    document.getElementById('audit-integrity').innerHTML = '<span style="color: var(--success);">VALIDATED</span>';
    
    const container = document.getElementById('log-audit-feed');
    const notice = document.createElement('div');
    notice.style.fontSize = '9px';
    notice.style.textAlign = 'center';
    notice.style.padding = '2px';
    notice.style.background = 'rgba(0, 212, 255, 0.05)';
    notice.style.color = 'var(--primary)';
    notice.style.marginBottom = '4px';
    notice.innerText = `>>> NEW BLOCK #${data.block_count - 1} COMMITTED TO LEDGER (PROOFOFWORK: OK)`;
    container.prepend(notice);
};

async function blockIP(threatId) {
    if (confirm('Are you sure you want to block this source IP?')) {
        const res = await api.post(`/threats/${threatId}/block`, {});
        if (res && res.success) {
            alert('IP Block initiated and recorded on blockchain.');
            fetchSummary();
        }
    }
}

async function fetchTimeline() {
    const res = await api.get('/dashboard/timeline');
    if (res && res.success) {
        const ctx = document.getElementById('threatLineChart').getContext('2d');
        const labels = res.data.map(d => d.hour);
        const data = res.data.map(d => d.threats);

        if (threatChart) threatChart.destroy();
        
        threatChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Threats Detected',
                    data: data,
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

async function fetchSeverityDist() {
    const res = await api.get('/dashboard/severity-distribution');
    if (res && res.success) {
        const ctx = document.getElementById('severityDoughnutChart').getContext('2d');
        const labels = res.data.map(d => (d._id && typeof d._id === 'string') ? d._id.toUpperCase() : "UNKNOWN");
        const data = res.data.map(d => d.count);

        if (severityChart) severityChart.destroy();

        severityChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#ff4444', '#ffaa00', '#00d4ff', '#00ff88'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#94a3b8' } }
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initDashboard);
