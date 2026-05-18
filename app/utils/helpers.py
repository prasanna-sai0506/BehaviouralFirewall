import re
import hashlib

def validate_ip(ip):
    """
    Validates IPv4 address
    """
    pattern = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
    if not pattern.match(ip):
        return False
    parts = ip.split(".")
    return all(0 <= int(part) <= 255 for part in parts)

def hash_data(data):
    """
    Returns SHA-256 hash of data
    """
    if isinstance(data, str):
        data = data.encode()
    return hashlib.sha256(data).hexdigest()
