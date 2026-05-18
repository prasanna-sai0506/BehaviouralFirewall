from datetime import datetime

class Threat:
    def __init__(self, source_ip, threat_type, severity, ml_confidence, details=None):
        self.source_ip = source_ip
        self.threat_type = threat_type
        self.severity = severity
        self.ml_confidence = ml_confidence
        self.details = details or {}
        self.timestamp = datetime.utcnow()
        self.status = "detected" # detected, blocked, resolved
        self.blockchain_index = None

    def to_dict(self):
        return {
            "source_ip": self.source_ip,
            "threat_type": self.threat_type,
            "severity": self.severity,
            "ml_confidence": self.ml_confidence,
            "details": self.details,
            "timestamp": self.timestamp,
            "status": self.status,
            "blockchain_index": self.blockchain_index
        }
