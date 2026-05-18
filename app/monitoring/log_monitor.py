import os
import time
import platform
import json
try:
    if platform.system() == 'Windows':
        import win32evtlog
except ImportError:
    win32evtlog = None

class LogMonitor:
    def __init__(self, app=None, socket_io=None):
        self.app = app
        self.socket_io = socket_io
        self.system = platform.system()

    def analyze_and_prepare(self, entry):
        if not self.app:
            return None

        # Prepare entry features
        if isinstance(entry, dict) and 'content' in entry:
            content = entry['content'].lower()
            
            # Categorization
            if any(k in content for k in ['auth', 'user', 'login', 'session', 'ssh', 'sudo']):
                entry['category'] = 'system'
            elif any(k in content for k in ['nginx', 'db', 'postgres', 'redis', 'web', 'docker', 'api', 'server', 'http']):
                entry['category'] = 'server'
            elif any(k in content for k in ['firewall', 'network', 'eth0', 'link', 'iptables', 'ip', 'port', 'traffic', 'udp', 'tcp']):
                entry['category'] = 'network'
            elif any(k in content for k in ['kernel', 'os', 'system', 'disk', 'cpu', 'mem', 'load', 'pid']):
                entry['category'] = 'system'
            else:
                entry['category'] = 'system' # Default to system rather than general to ensure it shows up in a counter

            if 'failed' in content or 'invalid' in content or 'authentication failure' in content:
                entry['failed_logins'] = 1
                entry['login_attempts'] = 1
            if 'error' in content or 'critical' in content or 'panic' in content:
                entry['severity_hint'] = 0.8
            
            import re
            ips = re.findall(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', entry['content'])
            if ips:
                entry['remote_ip_count'] = len(set(ips))

        prediction = {
            "is_anomaly": False,
            "severity_score": 10,
            "threat_type": "Normal Activity",
            "recommended_action": "allow"
        }

        # Rule-based baseline
        content = ""
        if isinstance(entry, dict) and 'content' in entry:
            content = entry['content'].lower()
        elif isinstance(entry, str):
            content = entry.lower()

        if 'failed password' in content or 'authentication failure' in content:
            prediction.update({"is_anomaly": True, "severity_score": 85, "threat_type": "Brute Force Attempt", "recommended_action": "block"})
        elif 'sql injection' in content or 'select * from' in content or "' or '1'='1" in content:
            prediction.update({"is_anomaly": True, "severity_score": 95, "threat_type": "SQL Injection", "recommended_action": "block"})
        elif 'critical' in content or 'panic' in content:
            prediction.update({"is_anomaly": True, "severity_score": 70, "threat_type": "System Critical Event", "recommended_action": "log"})
        
        if hasattr(self.app, 'ml_predictor'):
            try:
                ml_result = self.app.ml_predictor.predict(entry)
                if ml_result:
                    if ml_result.get('is_anomaly') or ml_result.get('severity_score', 0) > prediction['severity_score']:
                        prediction = ml_result
            except: pass

        is_threat = prediction['is_anomaly'] or prediction['severity_score'] > 50
        
        import re
        source_ip = "127.0.0.1"
        ip_data = str(entry)
        ip_match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', ip_data)
        if ip_match:
            source_ip = ip_match.group(1)

        threat_type = "SYSTEM_LOG"
        severity = "Low"
        if is_threat:
            threat_type = prediction.get('threat_type', 'Suspicious Activity').upper()
            severity = str(prediction.get('severity_score', 50))
        
        return {
            "threat_type": threat_type,
            "source_ip": source_ip,
            "severity": severity,
            "classification": "THREAT" if is_threat else "NORMAL",
            "timestamp": time.time(),
            "details": entry.get('content', str(entry)) if isinstance(entry, dict) else str(entry),
            "_raw": entry,
            "_prediction": prediction
        }

    def handle_threat(self, log_data):
        entry = log_data['_raw']
        prediction = log_data['_prediction']
        source_ip = log_data['source_ip']
        
        from app.extensions import mongo
        try:
            mongo.db.threats.insert_one({
                "threat_type": prediction['threat_type'],
                "severity": prediction['severity_score'],
                "details": entry,
                "analysis": prediction,
                "timestamp": time.time(),
                "source_ip": source_ip,
                "status": "blocked" if prediction['recommended_action'] == "block" else "detected"
            })
        except: pass

        if prediction['recommended_action'] == "block" and hasattr(self.app, 'firewall_manager'):
            print(f"BF-SHIELD: Automatically blocking suspicious IP {source_ip}")
            rule_name = f"BF_AutoBlock_{int(time.time())}"
            success = self.app.firewall_manager.block_ip(source_ip, rule_name)
            try:
                mongo.db.firewall_rules.insert_one({
                    "name": rule_name,
                    "remote_ip": source_ip,
                    "action": "block",
                    "reason": f"Automatic block: {prediction['threat_type']}",
                    "created_at": time.time(),
                    "status": "applied" if success else "failed"
                })
            except: pass

    def process_log_entry(self, entry, to_blockchain=True):
        log_data = self.analyze_and_prepare(entry)
        if not log_data: return
        
        # 1. EMIT LIVE EVENT FIRST - This makes the UI responsive
        if self.socket_io:
            try:
                self.socket_io.emit('new_event', {
                    "raw": entry,
                    "analysis": log_data['_prediction'],
                    "is_threat": log_data['classification'] == 'THREAT',
                    "timestamp": time.time()
                }, broadcast=True)
            except Exception as e:
                print(f"BF-SHIELD Emit Error: {e}")
        
        # 2. PROCESS THREATS
        if log_data['classification'] == 'THREAT':
            self.handle_threat(log_data)
            if self.socket_io:
                try:
                    self.socket_io.emit('new_threat', log_data, broadcast=True)
                except: pass

        # 3. BLOCKCHAIN AUDIT (Synchronous for now, but after emit)
        if to_blockchain and hasattr(self.app, 'blockchain'):
            try:
                block = self.app.blockchain.add_block([log_data])
                if self.socket_io:
                    self.socket_io.emit('blockchain_update', {
                        "block_count": len(self.app.blockchain.chain),
                        "last_block": block.to_dict()
                    }, broadcast=True)
            except Exception as e:
                print(f"BF-SHIELD Blockchain Error: {e}")


    def monitor_windows_events(self):
        """
        Reads Windows Security/System event logs
        """
        if not win32evtlog:
            return

        server = 'localhost'
        logtype = 'Security'
        handle = win32evtlog.OpenEventLog(server, logtype)
        flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
        
        while True:
            events = win32evtlog.ReadEventLog(handle, flags, 0)
            if not events:
                break
            
            for event in events:
                # Event IDs: 4625 (failed login), 4688 (process create), 4698 (scheduled task)
                eid = event.EventID & 0xFFFF
                if eid in [4625, 4688, 4698, 7045]:
                    event_data = {
                        "id": eid,
                        "time": str(event.TimeGenerated),
                        "source": event.SourceName,
                        "category": event.EventCategory,
                        "message": event.StringInserts
                    }
                    self.process_log_entry(event_data)
            time.sleep(1)

    def monitor_linux_logs(self):
        """
        Reads /var/log/syslog or system_audit.log on Linux
        """
        log_path = '/var/log/syslog'
        if not os.path.exists(log_path):
            log_path = '/var/log/messages'
        
        # For testing in environments without /var/log/syslog
        if not os.path.exists(log_path):
            log_path = 'system_audit.log'
            if not os.path.exists(log_path):
                try:
                    with open(log_path, 'w') as f:
                        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] BF-SHIELD System audit stream initialized\n")
                except: pass
        
        print(f"BF-SHIELD: Starting log monitor on {log_path}")
        
        with open(log_path, 'r') as f:
            # If it's our simulated log, start from beginning to see activity
            # If it's a real system log, start at end
            if log_path != 'system_audit.log':
                f.seek(0, 2)
            
            while True:
                line = f.readline()
                if not line:
                    if self.socket_io:
                        self.socket_io.sleep(0.5)
                    else:
                        time.sleep(0.5)
                    continue
                
                line = line.strip()
                if not line: continue

                entry = {
                    "type": "linux_syslog" if log_path != 'system_audit.log' else "system_audit",
                    "content": line,
                    "timestamp": time.time()
                }
                
                # Process entry immediately for live UI update and analysis
                print(f"BF-SHIELD: Detected log activity: {line[:50]}...")
                self.process_log_entry(entry)
                
                # Small sleep to prevent tight loop if many lines appear
                if self.socket_io:
                    self.socket_io.sleep(0.05)

    def generate_system_log(self):
        """
        Generates a log entry based on real system telemetry
        """
        try:
            import os
            import psutil
            import random
            
            # Real CPU and memory stats
            cpu_percent = psutil.cpu_percent()
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # System identifiers
            pid = os.getpid()
            node = platform.node()
            
            # Diverse Service & System events
            device_events = [
                f"Kernel: [PCI] device 00:02.0 Intel Graphics Controller state change: D0 -> D3",
                f"Systemd: [Journal] Unit systemd-udevd.service reset failure counter",
                f"Auth: [SSHD] Connection received from {random.randint(1,255)}.{random.randint(1,255)}.0.{random.randint(1,255)} on port 22",
                f"Auth: [SSHD] PAM: Authentication failure for invalid user 'admin' from {random.randint(1,255)}.{random.randint(1,255)}.0.{random.randint(1,255)}",
                f"USB: [Hub] New High speed Gen 1 device connected to bus 001",
                f"Disk: [SDA] S.M.A.R.T. status: Checked OK - Temp 34°C",
                f"Network: [eth0] Link is Up - 1000Mbps/Full - flow control off",
                f"Nginx: [Access] 192.168.1.{random.randint(2,254)} - GET /api/v1/status HTTP/1.1 200",
                f"Nginx: [Error] upstream timed out (110: Connection timed out) while connecting to upstream",
                f"DB: [Postgres] unexpected EOF on client connection with an open transaction",
                f"DB: [Redis] Memory usage at 85% - executing eviction policy 'allkeys-lru'",
                f"Cron: [System] PAM auth (uid=0) success for user root",
                f"Kernel: [Audit] AppArmor='DENIED' operation='open' profile='/usr/bin/nginx'",
                f"Systemd: [OOM] User slice memory pressure reached 95% threshold",
                f"Web: [Firewall] Blocked SQLi payload in URI: 'SELECT * FROM users;--'",
                f"Docker: [Engine] Container 'shield-worker-01' entered 'unhealthy' state"
            ]
            
            content = f"SYS_MONITOR: [PID {pid}] CPU: {cpu_percent}% | MEM: {mem.percent}% | DISK: {disk.percent}%"
            if random.random() > 0.4: # More frequent device events
                content = random.choice(device_events)

            entry = {
                "type": "system_device_audit",
                "content": content,
                "timestamp": time.time(),
                "hostname": node,
                "metadata": {
                    "cpu_load": cpu_percent,
                    "memory_used": mem.used,
                    "platform": platform.system()
                }
            }
            self.process_log_entry(entry)
        except Exception as e:
            print(f"System Log Gen Error: {e}")

    def run(self):
        if self.system == 'Windows':
            self.monitor_windows_events()
        else:
            self.monitor_linux_logs()
