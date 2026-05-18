from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required

blockchain_bp = Blueprint('blockchain', __name__)

@blockchain_bp.route('/chain', methods=['GET'])
@jwt_required()
def get_chain():
    blockchain = current_app.blockchain
    return jsonify({
        "success": True,
        "data": {
            "chain": blockchain.to_dict(),
            "length": len(blockchain.chain)
        }
    }), 200

@blockchain_bp.route('/block/<int:index>', methods=['GET'])
@jwt_required()
def get_block(index):
    blockchain = current_app.blockchain
    block = blockchain.get_block_by_index(index)
    if block:
        return jsonify({"success": True, "data": block.to_dict()}), 200
    return jsonify({"success": False, "message": "Block not found"}), 404

@blockchain_bp.route('/verify', methods=['GET'])
@jwt_required()
def verify_chain():
    blockchain = current_app.blockchain
    is_valid = blockchain.is_chain_valid()
    return jsonify({"success": True, "data": {"is_valid": is_valid}}), 200

@blockchain_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    blockchain = current_app.blockchain
    latest_block = blockchain.get_latest_block()
    tx_count = sum(len(block.transactions) for block in blockchain.chain)
    
    return jsonify({
        "success": True,
        "data": {
            "block_count": len(blockchain.chain),
            "transaction_count": tx_count,
            "last_block_time": latest_block.timestamp if latest_block else None,
            "difficulty": blockchain.difficulty
        }
    }), 200

@blockchain_bp.route('/latest-logs', methods=['GET'])
@jwt_required()
def get_latest_logs():
    blockchain = current_app.blockchain
    limit = request.args.get('limit', 20, type=int)
    logs = []
    # Traverse blocks from newest to oldest
    for block in reversed(blockchain.chain):
        if block.transactions:
            for tx in reversed(block.transactions):
                # Map tx to the format expectations of the UI
                logs.append({
                    "raw": tx.get('_raw', tx.get('details', '')),
                    "analysis": tx.get('_prediction', {}),
                    "is_threat": tx.get('classification') == 'THREAT',
                    "timestamp": block.timestamp
                })
                if len(logs) >= limit: break
        if len(logs) >= limit: break
    return jsonify({"success": True, "data": logs}), 200
