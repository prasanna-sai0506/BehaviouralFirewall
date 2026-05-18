import os
import pandas as pd
import numpy as np
from pymongo import MongoClient
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta
import json

# MongoDB Connection
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/behavioral_firewall')
client = MongoClient(MONGO_URI)
db = client.get_database()

def seed_users():
    print("Seeding users...")
    db.users.delete_many({})
    admin = {
        "email": "admin@shield.local",
        "username": "Admin",
        "password_hash": generate_password_hash("password123"),
        "role": "admin",
        "created_at": datetime.utcnow()
    }
    db.users.insert_one(admin)

def seed_threats():
    print("Seeding sample threats...")
    db.threats.delete_many({})
    threats = [
        {
            "source_ip": "192.168.1.105",
            "threat_type": "port_scan",
            "severity": "medium",
            "ml_confidence": 0.92,
            "timestamp": datetime.utcnow() - timedelta(minutes=45),
            "status": "detected"
        },
        {
            "source_ip": "45.33.22.11",
            "threat_type": "brute_force",
            "severity": "high",
            "ml_confidence": 0.98,
            "timestamp": datetime.utcnow() - timedelta(hours=2),
            "status": "blocked"
        }
    ]
    db.threats.insert_many(threats)

def generate_mock_training_data():
    print("Generating mock training data...")
    os.makedirs('data', exist_ok=True)
    
    n_samples = 1000
    classes = ["normal", "port_scan", "brute_force", "data_exfiltration", "privilege_escalation", "lateral_movement"]
    
    data = []
    for _ in range(n_samples):
        label = np.random.choice(classes, p=[0.7, 0.1, 0.05, 0.05, 0.05, 0.05])
        
        # Base features
        bytes_sent = np.random.randint(100, 5000)
        bytes_recv = np.random.randint(100, 5000)
        conn_count = np.random.randint(1, 50)
        failed_logins = 0
        cpu = np.random.uniform(0.1, 10.0)
        mem = np.random.uniform(0.1, 10.0)
        
        if label == "port_scan":
            conn_count = np.random.randint(100, 500)
            bytes_sent = np.random.randint(100, 500)
        elif label == "brute_force":
            failed_logins = np.random.randint(10, 100)
        elif label == "data_exfiltration":
            bytes_sent = np.random.randint(100000, 1000000)
        
        data.append({
            "bytes_sent": bytes_sent,
            "bytes_recv": bytes_recv,
            "connection_count": conn_count,
            "failed_logins": failed_logins,
            "process_cpu": cpu,
            "process_memory": mem,
            "hour_of_day": np.random.randint(0, 24),
            "day_of_week": np.random.randint(0, 7),
            "packet_size_avg": (bytes_sent + bytes_recv) / conn_count,
            "unique_ports": np.random.randint(1, 10) if label != "port_scan" else np.random.randint(50, 500),
            "login_attempts": 1 if label != "brute_force" else np.random.randint(10, 100),
            "label": label
        })
    
    df = pd.DataFrame(data)
    df.to_csv('data/training_data.csv', index=False)
    print("Data saved to data/training_data.csv")

if __name__ == "__main__":
    seed_users()
    seed_threats()
    generate_mock_training_data()
    print("Seeding complete.")
