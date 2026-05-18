import psutil
import time

class ProcessMonitor:
    def __init__(self, socket_io=None):
        self.socket_io = socket_io

    def get_process_stats(self):
        processes = []
        suspicious_procs = []
        
        for proc in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent']):
            try:
                pinfo = proc.info
                pinfo['cpu_percent'] = proc.cpu_percent() # Called twice to get meaningful value
                processes.append(pinfo)
                
                # Flag high CPU or suspicious names
                if pinfo['cpu_percent'] > 80:
                    suspicious_procs.append({
                        "pid": pinfo['pid'],
                        "name": pinfo['name'],
                        "reason": "high_cpu",
                        "value": pinfo['cpu_percent']
                    })
                
                suspicious_keywords = ["miner", "hack", "exploit", "nc", "ncat"]
                if any(k in pinfo['name'].lower() for k in suspicious_keywords):
                    suspicious_procs.append({
                        "pid": pinfo['pid'],
                        "name": pinfo['name'],
                        "reason": "suspicious_name"
                    })
                    
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        
        stats = {
            "total_processes": len(processes),
            "suspicious_processes": suspicious_procs,
            "timestamp": time.time()
        }
        
        if self.socket_io:
            self.socket_io.emit('process_update', stats)
            
        return stats
