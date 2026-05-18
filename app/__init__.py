import os
from flask import Flask, jsonify
from .config import config
from .extensions import mongo, socketio, jwt, cors
from .routes import register_routes
from .blockchain.chain import Blockchain
from .firewall.windows_fw import WindowsFirewallManager
from .ml.predictor import UnifiedPredictor
from .monitoring import MonitoringScheduler, LogMonitor, NetworkMonitor, ProcessMonitor
from .monitoring.log_service import AdvancedLogStreamer

def create_app(config_name='default'):
    app = Flask(__name__, static_folder='../frontend', static_url_path='')
    app.config.from_object(config[config_name])

    # Initialize extensions
    mongo.init_app(app)
    socketio.init_app(app)
    jwt.init_app(app)
    cors.init_app(app)

    # Initialize domain components
    app.blockchain = Blockchain(difficulty=app.config['BLOCKCHAIN_DIFFICULTY'])
    app.firewall_manager = WindowsFirewallManager()
    app.ml_predictor = UnifiedPredictor(app.config['MODEL_DIR'])

    # Register blueprints
    register_routes(app)

    @app.errorhandler(Exception)
    def handle_exception(e):
        # Pass through HTTP errors
        if hasattr(e, 'code'):
            return jsonify({"success": False, "message": str(e)}), e.code
        
        # Generic non-HTTP errors
        app.logger.error(f"Unhandled exception: {str(e)}")
        return jsonify({"success": False, "message": "Internal Server Error", "error": str(e)}), 500

    # Initialize monitoring
    # Note: We use a custom property to store components if needed elsewhere
    app.monitoring = {
        "log": LogMonitor(app, socketio),
        "advanced_log": AdvancedLogStreamer(app),
        "network": NetworkMonitor(socketio),
        "process": ProcessMonitor(socketio)
    }

    scheduler = MonitoringScheduler(app)
    app.scheduler = scheduler
    
    # Catch-all for frontend
    @app.route('/')
    def index():
        return app.send_static_file('index.html')

    return app
