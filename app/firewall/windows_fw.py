import subprocess
import platform
import re

class WindowsFirewallManager:
    def __init__(self):
        self.is_windows = platform.system() == 'Windows'

    def _validate_ip(self, ip):
        # Basic IPv4 validation
        pattern = re.compile(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$")
        return bool(pattern.match(ip))

    def _validate_name(self, name):
        # Allow alphanumeric, underscore, hyphen
        return bool(re.match(r"^[a-zA-Z0-9_\-]+$", name))

    def block_ip(self, ip, rule_name):
        if not self.is_windows:
            print(f"[Fallback] Would block {ip} on Linux using iptables")
            return True
        
        if not self._validate_ip(ip) or not self._validate_name(rule_name):
            return False

        try:
            # netsh advfirewall firewall add rule name="{rule_name}" dir=in action=block remoteip={ip}
            cmd = [
                "netsh", "advfirewall", "firewall", "add", "rule",
                f"name={rule_name}",
                "dir=in",
                "action=block",
                f"remoteip={ip}"
            ]
            result = subprocess.run(cmd, shell=False, capture_output=True, text=True)
            return result.returncode == 0
        except Exception as e:
            print(f"Firewall Error: {e}")
            return False

    def unblock_ip(self, ip, rule_name):
        if not self.is_windows:
            return True
            
        if not self._validate_name(rule_name):
            return False

        try:
            cmd = ["netsh", "advfirewall", "firewall", "delete", "rule", f"name={rule_name}"]
            result = subprocess.run(cmd, shell=False, capture_output=True, text=True)
            return result.returncode == 0
        except Exception as e:
            return False

    def list_rules(self):
        if not self.is_windows:
            return []
            
        try:
            cmd = ["netsh", "advfirewall", "firewall", "show", "rule", "name=all"]
            result = subprocess.run(cmd, shell=False, capture_output=True, text=True)
            # This would need parsing to return a structured list
            return result.stdout
        except:
            return ""

    def apply_rule(self, rule_obj):
        # rule_obj is instance of FirewallRule
        rule_name = f"BF_{rule_obj.remote_ip.replace('.', '_')}"
        if rule_obj.action == "block":
            return self.block_ip(rule_obj.remote_ip, rule_name)
        return True
