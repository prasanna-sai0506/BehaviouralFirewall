import numpy as np
import pandas as pd
from datetime import datetime

class FeatureExtractor:
    def __init__(self):
        pass

    def extract_features(self, raw_event):
        """
        Converts raw log dictionary to a feature vector
        raw_event: dict containing network or system metrics
        """
        # Expected metrics: bytes_sent, bytes_recv, connection_count, failed_logins, 
        # process_cpu, process_memory, timestamp
        
        # Default values if missing
        bytes_sent = raw_event.get('bytes_sent', 0)
        bytes_recv = raw_event.get('bytes_recv', 0)
        conn_count = raw_event.get('connection_count', 0)
        failed_logins = raw_event.get('failed_logins', 0)
        cpu_usage = raw_event.get('process_cpu', 0.0)
        mem_usage = raw_event.get('process_memory', 0.0)
        
        # Time-based features
        ts = raw_event.get('timestamp', datetime.now().timestamp())
        dt = datetime.fromtimestamp(ts)
        hour = dt.hour
        day_of_week = dt.weekday()
        
        # New features for RF
        packet_size_avg = (bytes_sent + bytes_recv) / (conn_count if conn_count > 0 else 1)
        unique_ports = raw_event.get('unique_ports', 1)
        login_attempts = raw_event.get('login_attempts', 1)

        features = [
            bytes_sent, bytes_recv, conn_count, failed_logins,
            cpu_usage, mem_usage, hour, day_of_week,
            packet_size_avg, unique_ports, login_attempts
        ]
        
        return np.array(features).reshape(1, -1)

    def get_feature_names(self):
        return [
            'bytes_sent', 'bytes_recv', 'connection_count', 'failed_logins',
            'process_cpu', 'process_memory', 'hour_of_day', 'day_of_week',
            'packet_size_avg', 'unique_ports', 'login_attempts'
        ]
