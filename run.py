import eventlet
eventlet.monkey_patch()

import os
from app import create_app, socketio

config_name = os.getenv('FLASK_ENV', 'default')
app = create_app(config_name)

if __name__ == '__main__':
    # Start scheduler
    app.scheduler.start()
    
    # Define job wrappers to avoid context issues
    def log_job():
        with app.app_context():
            app.monitoring['log'].run()

    def network_job():
        with app.app_context():
            app.monitoring['network'].get_network_stats()

    def process_job():
        with app.app_context():
            app.monitoring['process'].get_process_stats()

    # Add jobs to scheduler
    app.scheduler.add_monitoring_job(network_job, app.config['MONITORING_INTERVAL_NETWORK'], 'network_monitor')
    app.scheduler.add_monitoring_job(process_job, app.config['MONITORING_INTERVAL_PROCESS'], 'process_monitor')
    
    # Start log monitor in a background task
    socketio.start_background_task(log_job)
    app.monitoring['advanced_log'].start()
    
    # Run the app
    # Port 3000 is required for AI Studio accessibility
    port = int(os.environ.get('PORT', 3000))
    print(f"Starting server on port {port}...")
    socketio.run(app, host='0.0.0.0', port=port, debug=app.config['DEBUG'])
