from flask import Blueprint, jsonify, current_app
from flask_jwt_extended import jwt_required
from app.extensions import mongo
from datetime import datetime, timedelta

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_summary():
    total_threats = mongo.db.threats.count_documents({})
    blocked_ips = mongo.db.firewall_rules.count_documents({"action": "block"})
    blockchain_len = len(current_app.blockchain.chain)
    
    return jsonify({
        "success": True,
        "data": {
            "total_threats": total_threats,
            "blocked_ips": blocked_ips,
            "blockchain_length": blockchain_len,
            "system_status": "active"
        }
    }), 200

@dashboard_bp.route('/timeline', methods=['GET'])
@jwt_required()
def get_timeline():
    # Last 24 hours stats (mocked aggregation for speed)
    now = datetime.utcnow()
    timeline = []
    for i in range(24):
        hour = now - timedelta(hours=i)
        # In real app, query MongoDB for count between hour and hour+1
        timeline.append({"hour": hour.strftime("%H:00"), "threats": 0})
    
    return jsonify({"success": True, "data": timeline[::-1]}), 200

@dashboard_bp.route('/top-threats', methods=['GET'])
@jwt_required()
def get_top_threats():
    pipeline = [
        {"$group": {"_id": "$source_ip", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_ips = list(mongo.db.threats.aggregate(pipeline))
    return jsonify({"success": True, "data": top_ips}), 200

@dashboard_bp.route('/severity-distribution', methods=['GET'])
@jwt_required()
def get_severity_dist():
    pipeline = [
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
    ]
    dist = list(mongo.db.threats.aggregate(pipeline))
    return jsonify({"success": True, "data": dist}), 200
