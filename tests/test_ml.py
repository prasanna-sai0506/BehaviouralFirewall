import unittest
import numpy as np
from app.ml.feature_extractor import FeatureExtractor
from app.ml.isolation_forest import AnomalyDetector

class TestML(unittest.TestCase):
    def setUp(self):
        self.extractor = FeatureExtractor()
        self.detector = AnomalyDetector()

    def test_feature_extraction(self).
        event = {"bytes_sent": 100, "bytes_recv": 200, "connection_count": 5}
        features = self.extractor.extract_features(event)
        self.assertEqual(features.shape, (1, 11))

    def test_anomaly_detection(self):
        X = np.random.rand(10, 11)
        self.detector.train(X)
        pred = self.detector.predict(X[0:1])
        self.assertIn(pred, [1, -1])

if __name__ == '__main__':
    unittest.main()
