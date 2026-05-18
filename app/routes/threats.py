from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.extensions import mongo
from bson import ObjectId

threats_bp = Blueprint('threats', __name__)

@threats_bp.route('', methods=['GET'])
@jwt_required()
def get_threats():
    severity = request.args.get('severity')
    threat_type = request.args.get('type')
    source_ip = request.args.get('ip')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    
    query = {}
    if severity: query['severity'] = severity
    if threat_type: query['threat_type'] = threat_type
    if source_ip: query['source_ip'] = {"$regex": source_ip, "$options": "i"}
    
    threats_cursor = mongo.db.threats.find(query).sort('timestamp', -1).skip((page-1)*limit).limit(limit)
    threats = []
    for t in threats_cursor:
        t['_id'] = str(t['_id'])
        threats.append(t)
        
    return jsonify({"success": True, "data": threats}), 200

@threats_bp.route('/<id>', methods=['GET'])
@jwt_required()
def get_threat(id):
    threat = mongo.db.threats.find_one({"_id": ObjectId(id)})
    if threat:
        threat['_id'] = str(threat['_id'])
        return jsonify({"success": True, "data": threat}), 200
    return jsonify({"success": False, "message": "Threat not found"}), 404

@threats_bp.route('/<id>/block', methods=['POST'])
@jwt_required()
def block_threat_source(id):
    # This would trigger the firewall rule engine
    threat = mongo.db.threats.find_one({"_id": ObjectId(id)})
    if not threat:
        return jsonify({"success": False, "message": "Threat not found"}), 404
        
    # Logic to apply firewall rule
    return jsonify({"success": True, "message": f"Blocking IP {threat['source_ip']} initiated"}), 200

@threats_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_threat_stats():
    pipeline = [
        {"$group": {"_id": "$threat_type", "count": {"$sum": 1}}}
    ]
    type_stats = list(mongo.db.threats.aggregate(pipeline))
    
    pipeline_severity = [
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
    ]
    severity_stats = list(mongo.db.threats.aggregate(pipeline_severity))
    
    return jsonify({
        "success": True, 
        "data": {
            "by_type": type_stats,
            "by_severity": severity_stats
        }
    }), 200
