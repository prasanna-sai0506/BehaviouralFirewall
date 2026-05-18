from sklearn.svm import OneClassSVM
import joblib
import os

class InsiderDetector:
    def __init__(self, kernel="rbf", nu=0.05):
        self.model = OneClassSVM(kernel=kernel, nu=nu)

    def train(self, X):
        # Train ONLY on normal data
        self.model.fit(X)

    def predict(self, X):
        # 1 for normal, -1 for anomaly (potential insider threat)
        return self.model.predict(X)[0]

    def save(self, path):
        joblib.dump(self.model, path)

    def load(self, path):
        if os.path.exists(path):
            self.model = joblib.load(path)
            return True
        return False
