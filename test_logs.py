import time
import os

log_file = "mock_syslog.log"

# Wait for server to start
time.sleep(5)

test_logs = [
    "May 16 05:15:01 shield-host sshd[1234]: Failed password for invalid user admin from 192.168.1.50 port 54321 ssh2",
    "May 16 05:15:10 shield-host kernel: [123.456] CRITICAL: Potential Buffer Overflow detected in app_server at 0xdeadbeef",
    "May 16 05:15:20 shield-host sudo: pam_unix(sudo:auth): authentication failure; logname=uid=1001 euid=0 tty=/dev/pts/1 ruser= rhost=  user=root",
    "May 16 05:15:30 shield-host webapp: [THREAT] SQL Injection attempt detected from 10.0.0.99: ' OR 1=1 --",
]

print(f"Writing {len(test_logs)} test logs to {log_file}...")

with open(log_file, "a") as f:
    for log in test_logs:
        f.write(log + "\n")
        f.flush()
        print(f"Logged: {log}")
        time.sleep(2)

print("Test complete.")
