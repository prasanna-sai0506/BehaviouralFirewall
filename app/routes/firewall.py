from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from app.extensions import mongo
from app.models.firewall_rule import FirewallRule
from bson import ObjectId

firewall_bp = Blueprint('firewall', __name__)

@firewall_bp.route('/rules', methods=['GET'])
@jwt_required()
def get_rules():
    rules_cursor = mongo.db.firewall_rules.find().sort('created_at', -1)
    rules = []
    for r in rules_cursor:
        r['_id'] = str(r['_id'])
        rules.append(r)
    return jsonify({"success": True, "data": rules}), 200

@firewall_bp.route('/rules', methods=['POST'])
@jwt_required()
def add_rule():
    data = request.get_json()
    rule = FirewallRule(
        remote_ip=data.get('remote_ip'),
        action=data.get('action', 'block'),
        direction=data.get('direction', 'in'),
        protocol=data.get('protocol', 'any'),
        port=data.get('port', 'any'),
        duration=data.get('duration')
    )
    
    # Save to DB
    result = mongo.db.firewall_rules.insert_one(rule.to_dict())
    
    # Apply to OS (Mocked if not Windows)
    success = current_app.firewall_manager.apply_rule(rule)
    
    status = "applied" if success else "failed"
    mongo.db.firewall_rules.update_one({"_id": result.inserted_id}, {"$set": {"status": status}})
    
    return jsonify({"success": True, "message": "Rule added", "status": status}), 201

@firewall_bp.route('/rules/<id>', methods=['DELETE'])
@jwt_required()
def delete_rule(id):
    rule = mongo.db.firewall_rules.find_one({"_id": ObjectId(id)})
    if not rule:
        return jsonify({"success": False, "message": "Rule not found"}), 404
        
    # Remove from OS
    rule_name = f"BF_{rule['remote_ip'].replace('.', '_')}"
    current_app.firewall_manager.unblock_ip(rule['remote_ip'], rule_name)
    
    mongo.db.firewall_rules.delete_one({"_id": ObjectId(id)})
    return jsonify({"success": True, "message": "Rule deleted"}), 200

@firewall_bp.route('/status', methods=['GET'])
@jwt_required()
def get_status():
    is_windows = current_app.firewall_manager.is_windows
    return jsonify({"success": True, "data": {"system": "Windows" if is_windows else "Linux/Other", "active": True}}), 200
