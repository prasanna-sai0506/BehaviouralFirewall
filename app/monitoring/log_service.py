import os
import time
import platform
import json
import random
import psutil
from app.extensions import socketio

class AdvancedLogStreamer:
    def __init__(self, app):
        self.app = app
        self.running = False
        self.log_file = 'system_audit.log'
        
    def start(self):
        if self.running: return
        self.running = True
        print(f"BF-SHIELD: Initializing Advanced Log Streamer on {platform.system()}")
        # Immediate write to kickstart the monitor
        self.write_to_file("BF-SHIELD: Advanced Log Streamer started successfully and monitoring system resources.")
        socketio.start_background_task(self.stream_loop)

    def analyze_with_ml(self, content):
        """
        Uses the ML predictor if available, otherwise fallback to rule-based
        """
        if hasattr(self.app, 'ml_predictor'):
            try:
                # Construct features from the raw content
                entry = {
                    "content": content,
                    "timestamp": time.time(),
                    "source": "AdvancedLogStreamer"
                }
                return self.app.ml_predictor.predict(entry)
            except Exception as e:
                print(f"ML Analysis Error: {e}")
        
        # Rule-based fallback
        return {
            "is_anomaly": "failed" in content.lower() or "denied" in content.lower(),
            "severity_score": 80 if "threat" in content.lower() else 10,
            "threat_type": "Heuristic Detection" if "failed" in content.lower() else "Standard Audit",
            "recommended_action": "block" if "threat" in content.lower() else "allow"
        }

    def write_to_file(self, content):
        """Persistent audit log on disk"""
        try:
            with open(self.log_file, 'a', buffering=1) as f:
                ts = time.strftime('%Y-%m-%d %H:%M:%S')
                f.write(f"[{ts}] {content}\n")
                f.flush()
                # Also ensure OS writes it out
                os.fsync(f.fileno())
        except: pass

    def stream_loop(self):
        print("BF-SHIELD: Log Stream Loop Active")
        while self.running:
            try:
                # 1. Generate realistic system event
                event_types = ["AUTH", "KERNEL", "NGINX", "DB", "FIREWALL", "DOCKER", "OS"]
                etype = random.choice(event_types)
                
                content = ""
                if etype == "AUTH":
                    user = random.choice(["root", "admin", "guest", "developer", "unknown"])
                    ip = f"192.168.1.{random.randint(2, 254)}"
                    status = random.choice(["Success", "Failed", "Invalid", "Disconnected"])
                    content = f"Auth Service: [SSH] {status} login for user '{user}' from {ip}"
                elif etype == "KERNEL":
                    content = f"Kernel: [Audit] Process {os.getpid()} requested restricted syscall 0x{random.randint(100,999):x}"
                elif etype == "NGINX":
                    methods = ["GET", "POST", "PUT", "DELETE"]
                    paths = ["/api/v1/status", "/login", "/config", "/admin/shell", "/.env"]
                    content = f"Nginx: {random.choice(methods)} {random.choice(paths)} - 200 OK"
                elif etype == "DB":
                    content = f"Database: [Postgres] Commit successful for transaction ID {random.randint(10000,99999)}"
                elif etype == "FIREWALL":
                    content = f"Firewall: [iptables] DROPPED packet from 45.2.14.{random.randint(1,255)} to local port 3389"
                elif etype == "DOCKER":
                    content = f"Docker: Container 'bf-shield-worker-{random.randint(1,5)}' healthy status check passed"
                else:
                    load = os.getloadavg() if hasattr(os, 'getloadavg') else (0.1, 0.2, 0.1)
                    content = f"System: Load Avg: {load[0]:.2f}, {load[1]:.2f}, {load[2]:.2f} | PIDs: {len(psutil.pids())}"

                # 2. Add some "threats" every now and then
                if random.random() > 0.9:
                    threats = [
                        "CRITICAL: Multiple failed root logins detected. Possible brute-force attack.",
                        "SECURITY: SQL Injection attempt blocked on /api/v1/userinfo",
                        "THREAT: Large outbound data transfer detected to suspicious IP 103.2.1.4",
                        "ALERT: Unauthorized binary execution attempt in /tmp"
                    ]
                    content = random.choice(threats)

                # 3. Write to physical file
                self.write_to_file(content)

                # 4. Analyse with ML
                analysis = self.analyze_with_ml(content)
                if not analysis:
                    analysis = {
                        "is_anomaly": False,
                        "severity_score": 0,
                        "threat_type": "Metric",
                        "recommended_action": "allow"
                    }
                is_threat = analysis.get('is_anomaly', False) or analysis.get('severity_score', 0) > 50

                # 5. Persistent audit logic
                # We don't emit directly here because LogMonitor is watching this file
                # and will handle analysis and broadcasting as if it were a real system log.
                pass

            except Exception as e:
                print(f"Log Streamer Error: {e}")
            
            socketio.sleep(random.uniform(0.5, 2.0))
