const socket = io();

socket.on('connect', () => {
    console.log('Connected to Behavioral Firewall Socket Server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Generic notification system
function notify(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // In a real app, use a toast library
}

socket.on('new_threat', (threat) => {
    notify(`New threat detected: ${threat.threat_type} from ${threat.source_ip}`, 'danger');
    if (window.updateThreatFeed) {
        window.updateThreatFeed(threat);
    }
});

socket.on('new_firewall_rule', (rule) => {
    notify(`New firewall rule propagated for ${rule.remote_ip}`, 'warning');
});

socket.on('blockchain_update', (data) => {
    if (window.updateBlockchainStats) {
        window.updateBlockchainStats(data);
    }
});

socket.on('server_heartbeat', (data) => {
    console.log('Socket Heartbeat:', new Date(data.time * 1000).toLocaleTimeString());
});

socket.on('new_event', (event) => {
    console.log('Received new event:', event);
    if (window.updateLogAudit) {
        window.updateLogAudit(event);
    }
});
