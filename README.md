# Blockchain-Based Behavioral Firewall

A production-ready cybersecurity system to detect Zero-Day Threats and Insider Attacks using Machine Learning and a custom Blockchain.

## Features
- **Behavioral Analysis**: 3 ML models (Isolation Forest, Random Forest, One-Class SVM).
- **Immutable Logging**: Every threat event is recorded as a transaction on a custom SHA-256 blockchain.
- **Active Response**: Integrated with Windows Firewall (netsh) to automatically block malicious IPs.
- **Real-Time Monitoring**: Live dashboard with WebSocket updates.

## Tech Stack
- **Backend**: Python Flask, Flask-SocketIO, PyMongo.
- **ML**: Scikit-learn, Pandas, Numpy.
- **Frontend**: Vanilla HTML5/CSS3/JS, Chart.js.
- **Database**: MongoDB.

## Setup Instructions (Windows)
1. Ensure MongoDB is running locally.
2. Open PowerShell as Administrator.
3. Run `./scripts/install.ps1` to set up the environment and seed data.
4. Run `./scripts/start.ps1` to start the server.
5. Access the dashboard at `http://localhost:3000`.

## Credentials
- **Email**: admin@shield.local
- **Password**: password123
