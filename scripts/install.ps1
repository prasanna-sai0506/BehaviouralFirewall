# Behavioral Firewall Installation Script
# Run as Administrator

param(
    [string]$InstallPath = "C:\BehavioralFirewall",
    [switch]$InstallMongoDB,
    [switch]$CreateService
)

Write-Host "Behavioral Firewall Installation" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "This script requires Administrator privileges. Restarting..." -ForegroundColor Red
    Start-Process PowerShell -Verb RunAs "-File `"$PSCommandPath`" -InstallPath `"$InstallPath`" -InstallMongoDB:`$InstallMongoDB -CreateService:`$CreateService"
    exit
}

Write-Host "Running as Administrator - Continuing installation..." -ForegroundColor Green

# Create installation directory
Write-Host "Creating installation directory..." -ForegroundColor Yellow
if (Test-Path $InstallPath) {
    Write-Host "Installation directory already exists. Cleaning up..." -ForegroundColor Yellow
    Remove-Item -Path "$InstallPath\*" -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $InstallPath -Force
}

# Copy project files
Write-Host "Copying project files..." -ForegroundColor Yellow
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptPath

Copy-Item -Path "$ProjectRoot\*" -Destination $InstallPath -Recurse -Force -Exclude @("node_modules", "logs", ".git", "*.log")

# Install MongoDB if requested
if ($InstallMongoDB) {
    Write-Host "Installing MongoDB..." -ForegroundColor Yellow
    
    # Download and install MongoDB Community Edition
    $MongoInstaller = "$env:TEMP\mongodb-setup.exe"
    $MongoVersion = "6.0"
    
    try {
        Invoke-WebRequest -Uri "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-$MongoVersion-signed.msi" -OutFile $MongoInstaller
        
        Start-Process msiexec -ArgumentList "/i `"$MongoInstaller`" /quiet /norestart" -Wait
        
        # Create data directory
        $MongoDataPath = "C:\data\db"
        if (-not (Test-Path $MongoDataPath)) {
            New-Item -ItemType Directory -Path $MongoDataPath -Force
        }
        
        # Start MongoDB service
        Start-Service MongoDB
        
        Write-Host "MongoDB installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "Failed to install MongoDB: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Install Node.js dependencies
Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
Set-Location $InstallPath

if (Get-Command npm -ErrorAction SilentlyContinue) {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install npm dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "npm dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "Node.js and npm are required but not installed." -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Create logs directory
New-Item -ItemType Directory -Path "$InstallPath\logs" -Force

# Create Windows Service if requested
if ($CreateService) {
    Write-Host "Creating Windows Service..." -ForegroundColor Yellow
    
    # Install node-windows if not already installed
    npm install node-windows
    
    # Create service installation script
    $ServiceScript = @"
const { Service } = require('node-windows');
const path = require('path');

const svc = new Service({
    name: 'BehavioralFirewall',
    description: 'Blockchain-Based Behavioral Firewall for Zero-Day Threats & Insider Attacks',
    script: path.join(__dirname, 'app.js'),
    nodeOptions: [
        '--harmony',
        '--max_old_space_size=4096'
    ],
    workingDirectory: __dirname,
    env: [
        {
            name: 'NODE_ENV',
            value: 'production'
        }
    ]
});

svc.on('install', () => {
    console.log('Behavioral Firewall service installed successfully');
    svc.start();
});

svc.on('alreadyinstalled', () => {
    console.log('Behavioral Firewall service is already installed');
});

svc.on('start', () => {
    console.log('Behavioral Firewall service started');
});

svc.install();
"@

    $ServiceScript | Out-File -FilePath "$InstallPath\install-service.js" -Encoding UTF8
    
    # Install the service
    node "$InstallPath\install-service.js"
}

# Create startup script
$StartupScript = @"
# Behavioral Firewall Startup Script
Write-Host "Starting Behavioral Firewall..." -ForegroundColor Green

# Check if MongoDB is running
try {
    `$mongoStatus = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
    if (`$mongoStatus.Status -ne 'Running') {
        Write-Host "Starting MongoDB service..." -ForegroundColor Yellow
        Start-Service MongoDB
        Start-Sleep -Seconds 5
    }
} catch {
    Write-Host "MongoDB service not found. Please ensure MongoDB is installed and running." -ForegroundColor Red
    exit 1
}

# Start the application
Write-Host "Starting Behavioral Firewall Application..." -ForegroundColor Yellow
node app.js

Write-Host "Behavioral Firewall is running. Press Ctrl+C to stop." -ForegroundColor Green
"@

$StartupScript | Out-File -FilePath "$InstallPath\start-firewall.ps1" -Encoding UTF8

# Set execution policy to allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

Write-Host "`nInstallation completed successfully!" -ForegroundColor Green
Write-Host "Installation directory: $InstallPath" -ForegroundColor Cyan
Write-Host "`nTo start the firewall:" -ForegroundColor Yellow
Write-Host "1. Open PowerShell as Administrator" -ForegroundColor White
Write-Host "2. Navigate to: $InstallPath" -ForegroundColor White
Write-Host "3. Run: .\start-firewall.ps1" -ForegroundColor White
Write-Host "`nThe dashboard will be available at: http://localhost:3000" -ForegroundColor Cyan

if ($CreateService) {
    Write-Host "`nThe firewall service has been installed and will start automatically." -ForegroundColor Green
    Write-Host "You can manage the service using: Get-Service BehavioralFirewall" -ForegroundColor Cyan
}