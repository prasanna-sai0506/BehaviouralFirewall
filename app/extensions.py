from flask_pymongo import PyMongo
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from flask_cors import CORS
import os

class MongoProxy:
    def __init__(self):
        self._mongo = PyMongo()
        self._mock = None
        self._use_mock = False

    def init_app(self, app):
        try:
            # Check if we should use mock or try real
            if os.environ.get('USE_MOCK_DB', 'false').lower() == 'true':
                self._setup_mock()
                return

            # Note: init_app might be lazy but some drivers connect on init
            self._mongo.init_app(app)
            # We skip the ping as it might hang indefinitely in some environments
            print("MongoDB connected (lazy).")
        except Exception as e:
            print(f"MongoDB connection failed: {str(e)}. Falling back to mongomock...")
            self._setup_mock()

    def _setup_mock(self):
        import mongomock
        self._mock = mongomock.MongoClient().db
        self._use_mock = True
        self._seed_mock_data()

    def _seed_mock_data(self):
        # Admin user
        from werkzeug.security import generate_password_hash
        from datetime import datetime
        self._mock.users.insert_one({
            "email": "admin@shield.local",
            "username": "Admin",
            "password_hash": generate_password_hash("password123"),
            "role": "admin",
            "created_at": datetime.utcnow()
        })
        print("Mock DB seeded with admin@shield.local / password123")

    @property
    def db(self):
        if self._use_mock:
            return self._mock
        return self._mongo.db

mongo = MongoProxy()
socketio = SocketIO(cors_allowed_origins="*")
jwt = JWTManager()
cors = CORS()
