import psutil
import time
from collections import defaultdict

class NetworkMonitor:
    def __init__(self, socket_io=None):
        self.socket_io = socket_io
        self.last_io = psutil.net_io_counters()
        self.source_ips = defaultdict(set) # Tracking unique ports per source

    def get_network_stats(self):
        io = psutil.net_io_counters()
        bytes_sent = io.bytes_sent - self.last_io.bytes_sent
        bytes_recv = io.bytes_recv - self.last_io.bytes_recv
        self.last_io = io

        connections = psutil.net_connections(kind='inet')
        conn_count = len(connections)
        
        suspicious_ports = [4444, 1337, 31337, 8888]
        suspicious_conns = []
        
        for conn in connections:
            if conn.raddr:
                r_ip, r_port = conn.raddr
                self.source_ips[r_ip].add(r_port)
                
                if r_port in suspicious_ports:
                    suspicious_conns.append({
                        "ip": r_ip,
                        "port": r_port,
                        "status": conn.status
                    })

        # Port scan detection: >20 unique ports from same IP
        port_scans = []
        for ip, ports in self.source_ips.items():
            if len(ports) > 20:
                port_scans.append({"ip": ip, "unique_ports": len(ports)})
        
        # Reset tracking periodically or handle time window
        # For simplicity, we just return the current snapshot
        
        stats = {
            "bytes_sent": bytes_sent,
            "bytes_recv": bytes_recv,
            "connection_count": conn_count,
            "suspicious_connections": suspicious_conns,
            "port_scans": port_scans,
            "timestamp": time.time()
        }
        
        if self.socket_io:
            self.socket_io.emit('network_update', stats)
            
        return stats
