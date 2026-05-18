from .auth import auth_bp
from .threats import threats_bp
from .blockchain import blockchain_bp
from .firewall import firewall_bp
from .ml import ml_bp
from .dashboard import dashboard_bp

def register_routes(app):
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(threats_bp, url_prefix='/api/threats')
    app.register_blueprint(blockchain_bp, url_prefix='/api/blockchain')
    app.register_blueprint(firewall_bp, url_prefix='/api/firewall')
    app.register_blueprint(ml_bp, url_prefix='/api/ml')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
