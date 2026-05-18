import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-secret-key')
    MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/behavioral_firewall?serverSelectionTimeoutMS=2000&connectTimeoutMS=2000')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    
    # Blockchain settings
    BLOCKCHAIN_DIFFICULTY = 2
    
    # ML settings
    MODEL_DIR = os.path.join(os.getcwd(), 'ml_models')
    
    # Monitoring settings
    MONITORING_INTERVAL_NETWORK = 5
    MONITORING_INTERVAL_LOG = 5
    MONITORING_INTERVAL_PROCESS = 10
    
    SOCKETIO_ASYNC_MODE = os.environ.get('SOCKETIO_ASYNC_MODE', 'threading')

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
