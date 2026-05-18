async function loadThreats() {
    const searchIp = document.getElementById('search-ip').value;
    let url = '/threats';
    if (searchIp) url += `?ip=${searchIp}`;
    
    const res = await api.get(url);
    if (res && res.success) {
        const tbody = document.querySelector('#threats-table tbody');
        tbody.innerHTML = '';
        res.data.forEach(threat => {
            const row = document.createElement('tr');
            const date = new Date(threat.timestamp).toLocaleString();
            const severityStr = String(threat.severity || 'low');
            const severityClass = `severity-${severityStr.toLowerCase()}`;
            
            row.innerHTML = `
                <td>${date}</td>
                <td><code>${threat.source_ip}</code></td>
                <td>${threat.threat_type}</td>
                <td class="${severityClass}">${severityStr.toUpperCase()}</td>
                <td>${(threat.ml_confidence * 100).toFixed(1)}%</td>
                <td><span style="opacity: 0.7">${threat.status}</span></td>
                <td><span style="color: var(--success); font-size: 10px;">✔ VALIDATED</span></td>
                <td>
                    <button class="btn btn-danger" onclick="blockIP('${threat._id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">BLOCK</button>
                    <button class="btn" onclick="viewDetails('${threat._id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: #334155; color: white;">DETAILS</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
}

async function blockIP(id) {
    if (confirm('Confirm IP block? Block info will be stored on immutable blockchain.')) {
        const res = await api.post(`/threats/${id}/block`, {});
        if (res && res.success) {
            alert('IP Blocked successfully.');
            loadThreats();
        }
    }
}

function viewDetails(id) {
    alert('Detail view for ' + id + ' would show full ML feature breakdown.');
}

window.updateLogAudit = function(event) {
    const container = document.getElementById('full-log-audit');
    if (!container) return;
    
    const entry = document.createElement('div');
    entry.className = 'log-entry-item';
    entry.style.padding = '6px 10px';
    entry.style.marginBottom = '4px';
    entry.style.borderLeft = event.is_threat ? '3px solid var(--danger)' : '3px solid #2a2a2a';
    entry.style.background = event.is_threat ? 'rgba(255, 61, 0, 0.08)' : 'rgba(255, 255, 255, 0.02)';
    entry.style.transition = 'all 0.3s ease';
    
    const time = new Date().toLocaleTimeString();
    const typeColor = event.is_threat ? '#ff3d00' : '#00ff88';
    const typeLabel = event.is_threat ? '[THREAT_DETECTED]' : '[LOG_AUDITED]';
    
    const analysis = event.analysis || {};
    const severity = analysis.severity_score || (event.is_threat ? 75 : 10);
    const threatType = analysis.threat_type || (event.is_threat ? 'Anomaly' : 'System');
    
    const contentStr = event.raw.content || (typeof event.raw === 'string' ? event.raw : JSON.stringify(event.raw));
    
    entry.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <div style="display: flex; gap: 8px; align-items: center;">
                <span style="opacity: 0.4; font-size: 10px;">${time}</span> 
                <span style="color: ${typeColor}; font-weight: bold; font-size: 10px;">${typeLabel}</span>
                <span style="background: ${event.is_threat ? 'var(--danger)' : '#444'}; color: white; padding: 1px 4px; border-radius: 2px; font-size: 9px;">${threatType.toUpperCase()}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <span style="opacity: 0.3; font-size: 9px;">RISK SCORE: <span style="color: ${severity > 50 ? 'var(--danger)' : 'var(--success)'}">${severity}</span></span>
                <span style="color: var(--primary); font-size: 9px; opacity: 0.6;">BLOCKCHAIN: HASHED</span>
            </div>
        </div>
        <div style="opacity: 0.8; word-break: break-all; line-height: 1.4;">${contentStr}</div>
        ${event.is_threat ? `<div style="margin-top: 4px; padding: 4px; background: rgba(0,0,0,0.3); border-radius: 2px; border: 1px dashed var(--danger); color: var(--danger); font-size: 9px;">
            ML ANALYSIS: ${analysis.recommended_action === 'block' ? 'AUTOMATIC COUNTERMEASURE DEPLOYED' : 'ELEVATED RISK - MONITORING'}
        </div>` : ''}
    `;
    
    container.prepend(entry);
    
    // Animation effect
    setTimeout(() => {
        entry.style.background = event.is_threat ? 'rgba(255, 61, 0, 0.05)' : 'transparent';
    }, 1000);

    if (container.children.length > 50) {
        container.removeChild(container.lastChild);
    }
};

async function loadLogHistory() {
    try {
        const res = await api.get('/blockchain/latest-logs?limit=15');
        if (res && res.success) {
            // Process in reverse to prepend them in order (oldest to newest)
            res.data.reverse().forEach(log => {
                window.updateLogAudit(log);
            });
        }
    } catch (e) {
        console.error('History load error:', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadThreats();
    loadLogHistory();
});
