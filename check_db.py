import pymongo
import json
import os

mongo_uri = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/behavioral_firewall')
client = pymongo.MongoClient(mongo_uri)
db = client.get_database()

rules = list(db.firewall_rules.find())
for r in rules:
    r['_id'] = str(r['_id'])

print(json.dumps(rules, indent=2))
