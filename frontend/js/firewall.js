async function refreshFirewallStatus() {
    try {
        const res = await api.get('/firewall/status');
        const text = document.getElementById('fw-status-text');
        const pulse = document.getElementById('fw-status-pulse');
        
        if (res && res.success) {
            const data = res.data;
            text.innerText = `SERVICE: ACTIVE [${data.system.toUpperCase()}]`;
            pulse.style.background = 'var(--success)';
            pulse.style.boxShadow = '0 0 10px var(--success)';
            pulse.classList.add('pulse');
        } else {
            text.innerText = 'SERVICE: ERROR';
            pulse.style.background = 'var(--danger)';
            pulse.style.boxShadow = '0 0 10px var(--danger)';
            pulse.classList.remove('pulse');
        }
    } catch (e) {
        document.getElementById('fw-status-text').innerText = 'SERVICE: DISCONNECTED';
        const pulse = document.getElementById('fw-status-pulse');
        pulse.style.background = 'var(--warning)';
        pulse.style.boxShadow = '0 0 10px var(--warning)';
    }
}

async function loadRules() {
    const res = await api.get('/firewall/rules');
    if (res && res.success) {
        const tbody = document.querySelector('#rules-table tbody');
        tbody.innerHTML = '';
        res.data.forEach(rule => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><code>${rule.remote_ip}</code></td>
                <td><span style="color: ${rule.action === 'block' ? 'var(--danger)' : 'var(--success)'}">${String(rule.action || 'allow').toUpperCase()}</span></td>
                <td>${rule.port}</td>
                <td><span style="font-size: 0.8rem; opacity: 0.8;">${rule.status}</span></td>
                <td>
                    <button class="btn btn-danger" onclick="deleteRule('${rule._id}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">REMOVE</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
}

async function addManualRule() {
    const ip = document.getElementById('rule-ip').value;
    const action = document.getElementById('rule-action').value;
    const port = document.getElementById('rule-port').value;
    const btn = document.querySelector('button[onclick="addManualRule()"]');
    
    if (!ip) return alert('IP is required');
    
    btn.innerText = 'PROVISIONING RULE...';
    btn.disabled = true;
    
    try {
        const res = await api.post('/firewall/rules', {
            remote_ip: ip,
            action: action,
            port: port
        });
        
        if (res && res.success) {
            const statusStr = String(res.status || 'applied').toUpperCase();
            console.log('Rule deployment successful:', res);
            loadRules();
            document.getElementById('rule-ip').value = '';
            // Using a custom modal or just a better alert
            setTimeout(() => {
                alert(`SUCCESS: Firewall Rule Deployed\nStatus: ${statusStr}\nTarget: ${ip}\nLayer: Kernel Level [Active]`);
            }, 100);
        } else {
            console.error('Rule deployment failed:', res);
            alert('Deployment error: ' + (res.message || 'Unknown failure'));
        }
    } catch (e) {
        alert('API Connection Failure: ' + e);
    } finally {
        btn.innerText = 'DEPLOY RULE TO KERNEL';
        btn.disabled = false;
    }
}

async function deleteRule(id) {
    if (confirm('Are you sure you want to remove this firewall rule?')) {
        const res = await api.delete(`/firewall/rules/${id}`);
        if (res && res.success) {
            loadRules();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadRules();
    refreshFirewallStatus();
    // Poll status every 5 seconds
    setInterval(refreshFirewallStatus, 5000);
});
