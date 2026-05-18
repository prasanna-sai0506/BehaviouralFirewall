from datetime import datetime
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash

class User:
    def __init__(self, email, username, password, role="user"):
        self.email = email
        self.username = username
        self.password_hash = generate_password_hash(password)
        self.role = role
        self.created_at = datetime.utcnow()

    def to_dict(self):
        return {
            "email": self.email,
            "username": self.username,
            "password_hash": self.password_hash,
            "role": self.role,
            "created_at": self.created_at
        }

    @staticmethod
    def verify_password(password_hash, password):
        return check_password_hash(password_hash, password)
