import time
import os
import random

log_file = "mock_syslog.log"

# Potential "good" log templates
good_templates = [
    "May 16 {time} shield-host systemd[1]: Starting User Manager for UID 1000...",
    "May 16 {time} shield-host systemd[1]: Started Session 1 of user pi.",
    "May 16 {time} shield-host kernel: [123.{rev}] intel_pstate: HWP enabled",
    "May 16 {time} shield-host dbus-daemon[456]: [system] Activating via systemd: service name='org.freedesktop.hostname1' unit='dbus-org.freedesktop.hostname1.service' requested by ':1.12' (uid=1000 pid=789 comm='/usr/bin/python3 /app/run.py ')",
    "May 16 {time} shield-host NetworkManager[321]: <info>  [123456789.0] device (eth0): state change: desktop -> wifi",
    "May 16 {time} shield-host CRON[987]: (root) CMD (   cd / && run-parts --report /etc/cron.hourly)",
    "May 16 {time} shield-host PackageKit: get-updates transaction /123_abc complete",
]

threat_logs = [
    "May 16 05:25:00 shield-host sshd[9999]: Failed password for root from 192.168.1.100 port 1234 ssh2",
    "May 16 05:26:00 shield-host webapp: [CRITICAL] SQL Injection detected from 45.33.22.11: GET /user?id=1' OR '1'='1"
]

print(f"Generating 1000 normal logs followed by 2 threat logs in {log_file}...")

with open(log_file, "a") as f:
    # 1. 1000 Normal logs
    for i in range(1000):
        t = time.strftime("%H:%M:%S", time.gmtime(time.time() - (1000-i)))
        rev = random.randint(100, 999)
        template = random.choice(good_templates)
        log = template.format(time=t, rev=rev)
        f.write(log + "\n")
        if i % 100 == 0:
            print(f"Progress: {i}/1000 logs written...")
            f.flush()
        # Small sleep to allow processing
        time.sleep(0.01)

    # 2. 2 Threat logs
    for log in threat_logs:
        f.write(log + "\n")
        f.flush()
        print(f"THREAT LOGGED: {log}")
        time.sleep(0.5)

print("Generation complete. Check your Blockchain and Dashboard!")
