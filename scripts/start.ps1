# start.ps1 — Start all services
.\venv\Scripts\activate
$env:FLASK_ENV = "development"
$env:MONGO_URI = "mongodb://localhost:27017/behavioral_firewall"
python run.py
