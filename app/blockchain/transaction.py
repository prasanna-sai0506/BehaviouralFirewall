from dataclasses import dataclass, asdict

@dataclass
class ThreatTransaction:
    threat_id: str
    source_ip: str
    threat_type: str
    severity: str
    ml_confidence: float
    timestamp: float
    action_taken: str

    def to_dict(self):
        return asdict(self)
