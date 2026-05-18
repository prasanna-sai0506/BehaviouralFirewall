from app.models.firewall_rule import FirewallRule

class RuleEngine:
    def __init__(self):
        pass

    def generate_rule(self, threat_result, source_ip):
        """
        Creates a FirewallRule from a ML prediction
        """
        # threat_result from UnifiedPredictor
        severity = threat_result.get('severity_score', 0)
        threat_type = threat_result.get('threat_type', 'unknown')
        
        action = "monitor"
        duration = None # permanent
        
        if severity > 80:
            action = "block"
        elif severity > 50:
            action = "block"
            duration = 60 # 1 hour temporary block
            
        rule = FirewallRule(
            remote_ip=source_ip,
            action=action,
            direction="in",
            protocol="any",
            port="any",
            duration=duration
        )
        
        return rule
