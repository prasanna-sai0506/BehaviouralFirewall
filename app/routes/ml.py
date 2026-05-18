from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from app.ml.trainer import train_all_models
import os

ml_bp = Blueprint('ml', __name__)

@ml_bp.route('/status', methods=['GET'])
@jwt_required()
def get_ml_status():
    model_dir = current_app.config['MODEL_DIR']
    models_exist = {
        "isolation_forest": os.path.exists(os.path.join(model_dir, 'isolation_forest.joblib')),
        "random_forest": os.path.exists(os.path.join(model_dir, 'random_forest.joblib')),
        "svm_insider": os.path.exists(os.path.join(model_dir, 'svm_insider.joblib'))
    }
    return jsonify({"success": True, "data": {"models": models_exist}}), 200

@ml_bp.route('/train', methods=['POST'])
@jwt_required()
def trigger_training():
    data_path = os.path.join(os.getcwd(), 'data', 'training_data.csv')
    model_dir = current_app.config['MODEL_DIR']
    
    # In a real app, this should be done in a background task
    metrics = train_all_models(data_path, model_dir)
    
    if metrics:
        return jsonify({"success": True, "data": metrics, "message": "Models trained successfully"}), 200
    return jsonify({"success": False, "message": "Training failed (data missing?)"}), 400

@ml_bp.route('/predict', methods=['POST'])
@jwt_required()
def manual_predict():
    data = request.get_json()
    prediction = current_app.ml_predictor.predict(data)
    if prediction:
        return jsonify({"success": True, "data": prediction}), 200
    return jsonify({"success": False, "message": "Prediction failed"}), 400
