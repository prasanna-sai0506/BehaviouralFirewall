from pymongo import MongoClient
import os

mongo_uri = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/behavioral_firewall')
client = MongoClient(mongo_uri)
db = client.get_database()

print(f"Collection 'threats' count: {db.threats.count_documents({})}")
print(f"Collection 'firewall_rules' count: {db.firewall_rules.count_documents({})}")
