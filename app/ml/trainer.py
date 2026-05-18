import os
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from .feature_extractor import FeatureExtractor
from .isolation_forest import AnomalyDetector
from .random_forest import ThreatClassifier
from .svm_insider import InsiderDetector

def train_all_models(data_path, model_dir):
    os.makedirs(model_dir, exist_ok=True)
    extractor = FeatureExtractor()
    
    if not os.path.exists(data_path):
        print("Data path not found, cannot train.")
        return None

    df = pd.read_csv(data_path)
    # Features: bytes_sent, bytes_recv, connection_count, failed_logins, process_cpu, process_memory, hour_of_day, day_of_week
    # Label: "label" (string: normal, port_scan, etc.)
    
    X = df.drop(columns=['label'])
    y = df['label']
    
    # Class mapping for Classifier
    classes = ["normal", "port_scan", "brute_force", "data_exfiltration", "privilege_escalation", "lateral_movement"]
    y_mapped = y.map(lambda x: classes.index(x) if x in classes else 0)

    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y_mapped, test_size=0.2, random_state=42)

    # 1. Train Isolation Forest (on all training data, as it's unsupervised/semi-supervised)
    anomaly_detector = AnomalyDetector()
    anomaly_detector.train(X_train)
    anomaly_detector.save(os.path.join(model_dir, 'isolation_forest.joblib'))

    # 2. Train Random Forest Classifier
    threat_classifier = ThreatClassifier()
    threat_classifier.train(X_train, y_train)
    threat_classifier.save(os.path.join(model_dir, 'random_forest.joblib'))

    # 3. Train One-Class SVM (ONLY on 'normal' samples)
    X_normal = X_train[y_train == 0] # 0 = normal
    insider_detector = InsiderDetector()
    insider_detector.train(X_normal)
    insider_detector.save(os.path.join(model_dir, 'svm_insider.joblib'))

    # Evaluate Classifier
    y_pred = threat_classifier.model.predict(X_test)
    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, average='weighted'),
        "recall": recall_score(y_test, y_pred, average='weighted'),
        "f1": f1_score(y_test, y_pred, average='weighted')
    }
    
    return metrics
