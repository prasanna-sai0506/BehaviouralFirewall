from apscheduler.schedulers.background import BackgroundScheduler
import time

class MonitoringScheduler:
    def __init__(self, app_context):
        self.scheduler = BackgroundScheduler()
        self.app_context = app_context
        self.jobs = []

    def add_monitoring_job(self, func, interval, id):
        self.scheduler.add_job(
            func=func,
            trigger="interval",
            seconds=interval,
            id=id
        )

    def start(self):
        self.scheduler.start()

    def stop(self):
        self.scheduler.shutdown()
