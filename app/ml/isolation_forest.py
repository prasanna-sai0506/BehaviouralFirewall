from sklearn.ensemble import IsolationForest
import joblib
import os

class AnomalyDetector:
    def __init__(self, contamination=0.1):
        self.model = IsolationForest(contamination=contamination, random_state=42)

    def train(self, X):
        self.model.fit(X)

    def predict(self, X):
        # returns 1 for normal, -1 for anomaly
        return self.model.predict(X)[0]

    def score_samples(self, X):
        # returns anomaly score (lower is more anomalous)
        return self.model.score_samples(X)[0]

    def save(self, path):
        joblib.dump(self.model, path)

    def load(self, path):
        if os.path.exists(path):
            self.model = joblib.load(path)
            return True
        return False
        
