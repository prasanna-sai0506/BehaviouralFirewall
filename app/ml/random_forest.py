from sklearn.ensemble import RandomForestClassifier
import joblib
import os

class ThreatClassifier:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.classes = ["normal", "port_scan", "brute_force", "data_exfiltration", "privilege_escalation", "lateral_movement"]

    def train(self, X, y):
        self.model.fit(X, y)

    def predict(self, X):
        # returns predicted label
        pred_idx = self.model.predict(X)[0]
        # In case y was labels directly
        if isinstance(pred_idx, str):
            return pred_idx
        return self.classes[pred_idx]

    def predict_proba(self, X):
        # returns probability per class
        return self.model.predict_proba(X)[0]

    def save(self, path):
        joblib.dump(self.model, path)

    def load(self, path):
        if os.path.exists(path):
            self.model = joblib.load(path)
            return True
        return False

    def get_feature_importances(self):
        return self.model.feature_importances_
