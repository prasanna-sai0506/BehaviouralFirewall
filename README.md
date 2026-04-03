# Behavioral Firewall

A Blockchain-Based Behavioral Firewall for Zero-Day Threats & Insider Attacks using real-time behavioral analysis (AI/ML) to detect and block threats while maintaining a tamper-proof history.

## Features

- **Real-time Monitoring**: Continuous monitoring of system logs, network activity, and processes
- **Behavioral Analysis**: AI/ML-powered threat detection based on behavioral patterns
- **Blockchain Integration**: Tamper-proof audit trail using blockchain technology
- **Automated Response**: Automatic firewall rule generation and propagation
- **Web Dashboard**: Real-time visualization and management interface
- **Windows Integration**: Native Windows firewall and event log integration

## Architecture
┌─────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│ Monitoring │ │ Threat Detection│ │ Blockchain │
│ │ │ │ │ │
│ • System Logs │───▶│ • Behavioral │───▶│ • Immutable │
│ • Network │ │ Analysis │ │ Ledger │
│ • Processes │ │ • Pattern │ │ • Smart │
└─────────────────┘ │ Matching │ │ Contracts │
└──────────────────┘ └─────────────────┘
│ │
▼ ▼
┌─────────────────┐ ┌─────────────────┐
│ Firewall │ │ Dashboard │
│ Management │ │ │
│ │ │ • Real-time │
│ • Rule Engine │ │ Monitoring │
│ • Propagation │ │ • Analytics │
└─────────────────┘ └─────────────────┘

text

## Installation

### Prerequisites

- Windows 10/11
- Node.js 16+ 
- MongoDB 5.0+
- Administrator privileges

### Quick Install

1. **Download and extract** the project files
2. **Run PowerShell as Administrator**
3. **Execute the installation script**:
```powershell
.\scripts\install.ps1 -InstallMongoDB -CreateService
