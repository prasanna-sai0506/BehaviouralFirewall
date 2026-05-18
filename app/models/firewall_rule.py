from datetime import datetime

class FirewallRule:
    def __init__(self, remote_ip, action="block", direction="in", protocol="any", port="any", duration=None):
        self.remote_ip = remote_ip
        self.action = action
        self.direction = direction
        self.protocol = protocol
        self.port = port
        self.duration = duration # minutes, None means permanent
        self.created_at = datetime.utcnow()
        self.status = "pending" # pending, applied, failed, removed

    def to_dict(self):
        return {
            "remote_ip": self.remote_ip,
            "action": self.action,
            "direction": self.direction,
            "protocol": self.protocol,
            "port": self.port,
            "duration": self.duration,
            "created_at": self.created_at,
            "status": self.status
        }
