class RulePropagator:
    def __init__(self, socket_io):
        self.socket_io = socket_io

    def propagate_rule(self, rule_obj):
        """
        Broadcasts new rules to all connected agents via SocketIO room "agents"
        """
        # rule_obj: a dict or object representing the firewall rule
        if hasattr(rule_obj, 'to_dict'):
            payload = rule_obj.to_dict()
        else:
            payload = rule_obj

        self.socket_io.emit('new_firewall_rule', payload, room='agents')
        print(f"Propagated rule for {payload.get('remote_ip')} to agents")
