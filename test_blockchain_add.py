import sys
import os
import json
from app import create_app

app = create_app('default')
with app.app_context():
    print(f"Initial chain length: {len(app.blockchain.chain)}")
    
    # Manually process a threat entry
    entry = {
        "type": "manual_test",
        "content": "May 16 09:00:00 shield-host sshd[123]: Failed password for root from 1.2.3.4",
        "timestamp": 123456789
    }
    
    print("Processing manual entry...")
    app.monitoring['log'].process_log_entry(entry)
    
    print(f"New chain length: {len(app.blockchain.chain)}")
    
    # Verify file
    if os.path.exists('blockchain_data.json'):
        with open('blockchain_data.json', 'r') as f:
            data = json.load(f)
            print(f"File chain length: {len(data)}")
