import json
import hashlib
from time import time
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

class Block:
    def __init__(self, index, transactions, timestamp, previous_hash, nonce=0):
        self.index = index
        self.timestamp = timestamp
        self.transactions = transactions
        self.previous_hash = previous_hash
        self.nonce = nonce
        self.hash = self.hash_block()

    def hash_block(self):
        """
        Creates a SHA-256 hash of a block
        """
        block_string = json.dumps({
            "index": self.index,
            "timestamp": self.timestamp,
            "transactions": self.transactions,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce
        }, sort_keys=True).encode()
        return hashlib.sha256(block_string).hexdigest()

    def __repr__(self):
        return f"<Block index={self.index} hash={self.hash[:8]}...>"

    def to_dict(self):
        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "transactions": self.transactions,
            "previous_hash": self.previous_hash,
            "nonce": self.nonce,
            "hash": self.hash
        }
