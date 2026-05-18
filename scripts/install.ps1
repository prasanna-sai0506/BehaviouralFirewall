# install.ps1 — Windows Setup Script
Write-Host "Setting up Behavioral Firewall Environment..." -ForegroundColor Cyan

# Check for Python
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python not found. Please install Python 3.10+."
    exit
}

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create directories
New-Item -ItemType Directory -Path "logs", "ml_models", "data" -Force

# Seed data
python scripts/seed_data.py

Write-Host "Setup complete. Run ./start.ps1 to begin." -ForegroundColor Green
