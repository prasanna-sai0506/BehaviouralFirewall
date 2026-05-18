import os
import numpy as np
from .feature_extractor import FeatureExtractor
from .isolation_forest import AnomalyDetector
from .random_forest import ThreatClassifier
from .svm_insider import InsiderDetector

class UnifiedPredictor:
    def __init__(self, model_dir):
        self.extractor = FeatureExtractor()
        self.anomaly_model = AnomalyDetector()
        self.classifier_model = ThreatClassifier()
        self.insider_model = InsiderDetector()
        self.model_dir = model_dir
        
        if not os.path.exists(model_dir):
            os.makedirs(model_dir)

        # Load or Train
        if not self.anomaly_model.load(os.path.join(model_dir, 'isolation_forest.joblib')):
            print("BF-SHIELD: ML models missing. Initializing dummy bootstrap models...")
            self._bootstrap_models()
        else:
            self.classifier_model.load(os.path.join(model_dir, 'random_forest.joblib'))
            self.insider_model.load(os.path.join(model_dir, 'svm_insider.joblib'))

    def _bootstrap_models(self):
        """Train models with synthetic data to ensure they are fitted"""
        # 11 features matches FeatureExtractor
        X = np.random.rand(100, 11)
        self.anomaly_model.train(X)
        self.anomaly_model.save(os.path.join(self.model_dir, 'isolation_forest.joblib'))
        
        y = np.random.choice(['NORMAL', 'SQL_INJECTION', 'BRUTE_FORCE', 'XSS'], 100)
        self.classifier_model.train(X, y)
        self.classifier_model.save(os.path.join(self.model_dir, 'random_forest.joblib'))
        
        self.insider_model.train(X)
        self.insider_model.save(os.path.join(self.model_dir, 'svm_insider.joblib'))
        print("BF-SHIELD: Bootstrap models fitted and saved.")

    def predict(self, raw_event):
        try:
            X = self.extractor.extract_features(raw_event)
            
            # 1. Anomaly Detection
            is_anomaly = self.anomaly_model.predict(X) == -1
            anomaly_score = self.anomaly_model.score_samples(X)
            
            # 2. Threat Classification
            threat_type = self.classifier_model.predict(X)
            probs = self.classifier_model.predict_proba(X)
            confidence = float(np.max(probs))
            
            # 3. Insider Risk
            is_insider_risk = self.insider_model.predict(X) == -1
            
            # Calculate Severity (0-100)
            severity_score = 0
            if is_anomaly: severity_score += 40
            if is_insider_risk: severity_score += 30
            severity_score += (confidence * 30)
            
            # Cap severity
            severity_score = min(100, int(severity_score))
            
            # Recommended Action
            action = "monitor"
            if severity_score > 80:
                action = "block"
            elif severity_score > 50:
                action = "throttle"
            
            return {
                "is_anomaly": is_anomaly,
                "threat_type": threat_type,
                "insider_risk": is_insider_risk,
                "confidence": confidence,
                "severity_score": severity_score,
                "recommended_action": action,
                "probabilities": {name: float(p) for name, p in zip(self.classifier_model.classes, probs)}
            }
        except Exception as e:
            print(f"Prediction Error: {e}")
            return None
