# Behavioral Firewall Startup Script
# Run as Administrator

Write-Host "Behavioral Firewall Startup" -ForegroundColor Green
Write-Host "===========================" -ForegroundColor Green

# Check if running as Administrator (fixed version)
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-NOT $isAdmin) {
    Write-Host "This script requires Administrator privileges. Restarting..." -ForegroundColor Red
    Start-Process PowerShell -Verb RunAs "-File `"$PSCommandPath`""
    exit
}

Write-Host "Running as Administrator - Starting firewall..." -ForegroundColor Green

# Check if MongoDB is running
try {
    $mongoStatus = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    if ($mongoStatus -and $mongoStatus.Status -ne 'Running') {
        Write-Host "Starting MongoDB service..." -ForegroundColor Yellow
        Start-Service "MongoDB" -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 5
        
        # Verify MongoDB started
        $mongoStatus = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
        if ($mongoStatus.Status -ne 'Running') {
            Write-Host "MongoDB service found but not running. Starting application in mock mode..." -ForegroundColor Yellow
        }
    }
    
    if ($mongoStatus -and $mongoStatus.Status -eq 'Running') {
        Write-Host "MongoDB is running" -ForegroundColor Green
    } else {
        Write-Host "MongoDB service not found or not running. Running in mock database mode." -ForegroundColor Yellow
    }
} catch {
    Write-Host "MongoDB service not accessible. Running in mock database mode." -ForegroundColor Yellow
}

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Node.js dependencies not found. Installing..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Create necessary directories
$directories = @("logs", "data", "config")
foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
}

# Start the application
Write-Host "Starting Behavioral Firewall Application..." -ForegroundColor Yellow
try {
    node app.js
} catch {
    Write-Host "Failed to start application: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Behavioral Firewall has stopped." -ForegroundColor Yellow