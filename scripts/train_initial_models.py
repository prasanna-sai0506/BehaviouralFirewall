import os
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.svm import OneClassSVM
import joblib

# Create directory
model_dir = 'ml_models'
if not os.path.exists(model_dir):
    os.makedirs(model_dir)

# 1. Anomaly Detector (IsolationForest)
# Create synthetic data: 10 features, 100 samples
X = np.random.rand(100, 10)
anomaly_model = IsolationForest(contamination=0.1, random_state=42)
anomaly_model.fit(X)
joblib.dump(anomaly_model, os.path.join(model_dir, 'isolation_forest.joblib'))
print("Trained IsolationForest")

# 2. Threat Classifier (RandomForest)
# Classes: NORMAL, SQL_INJECTION, BRUTE_FORCE, XSS
X_train = np.random.rand(200, 10)
y_train = np.random.choice(['NORMAL', 'SQL_INJECTION', 'BRUTE_FORCE', 'XSS'], 200)
classifier_model = RandomForestClassifier(n_estimators=100, random_state=42)
classifier_model.fit(X_train, y_train)
joblib.dump(classifier_model, os.path.join(model_dir, 'random_forest.joblib'))
print("Trained RandomForestClassifier")

# 3. Insider Detector (OneClassSVM)
X_insider = np.random.rand(50, 10)
insider_model = OneClassSVM(nu=0.1, kernel="rbf", gamma=0.1)
insider_model.fit(X_insider)
joblib.dump(insider_model, os.path.join(model_dir, 'svm_insider.joblib'))
print("Trained InsiderDetector (OneClassSVM)")

print(f"All models saved to {model_dir}")
