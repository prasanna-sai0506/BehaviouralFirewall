import logging
import os

def setup_logger():
    log_dir = os.path.join(os.getcwd(), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    logger = logging.getLogger('behavioral_firewall')
    logger.setLevel(logging.INFO)
    
    file_handler = logging.FileHandler(os.path.join(log_dir, 'app.log'))
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    return logger

logger = setup_logger()
