import os
print(f"/var/log/syslog exists: {os.path.exists('/var/log/syslog')}")
print(f"/var/log/messages exists: {os.path.exists('/var/log/messages')}")
print(f"mock_syslog.log exists: {os.path.exists('mock_syslog.log')}")
