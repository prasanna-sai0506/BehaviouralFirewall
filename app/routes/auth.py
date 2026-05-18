from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.models.user import User
from app.extensions import mongo
from datetime import datetime

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    username = data.get('username')
    password = data.get('password')
    
    if not email or not username or not password:
        return jsonify({"success": False, "message": "Missing required fields"}), 400
    
    if mongo.db.users.find_one({"email": email}):
        return jsonify({"success": False, "message": "Email already registered"}), 400
        
    user = User(email, username, password)
    mongo.db.users.insert_one(user.to_dict())
    
    return jsonify({"success": True, "message": "User registered successfully"}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No input data provided"}), 400
            
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({"success": False, "message": "Email and password are required"}), 400
            
        user_data = mongo.db.users.find_one({"email": email})
        if user_data and User.verify_password(user_data['password_hash'], password):
            access_token = create_access_token(identity=str(user_data['_id']))
            return jsonify({
                "success": True,
                "data": {
                    "access_token": access_token,
                    "username": user_data['username'],
                    "role": user_data['role']
                }
            }), 200
            
        return jsonify({"success": False, "message": "Invalid email or password"}), 401
    except Exception as e:
        return jsonify({"success": False, "message": f"Server error during login: {str(e)}"}), 500

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    try:
        user_id = get_jwt_identity()
        from bson import ObjectId
        user_data = mongo.db.users.find_one({"_id": ObjectId(user_id)})
        if not user_data:
            return jsonify({"success": False, "message": "User not found"}), 404
            
        return jsonify({
            "success": True, 
            "data": {
                "user_id": user_id,
                "username": user_data.get('username'),
                "email": user_data.get('email'),
                "role": user_data.get('role')
            }
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Error fetching user profile: {str(e)}"}), 500
