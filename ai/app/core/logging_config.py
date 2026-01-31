import logging
import os
import sys
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler

def setup_logging(log_dir: str = "logs", log_level: int = logging.INFO):
    """
    Sets up the logging configuration for the application.
    - Console handler (INFO+)
    - Debug file handler (DEBUG+)
    - Error file handler (ERROR+)
    """
    
    # Create logs directory if it doesn't exist
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    # common formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Root logger
    logger = logging.getLogger()
    logger.setLevel(logging.DEBUG) # Catch everything at root, handlers will filter exactly what they want
    
    # Clear existing handlers to avoid duplicates if called multiple times
    if logger.hasHandlers():
        logger.handlers.clear()

    # 1. Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 2. Debug File Handler (Rotating)
    debug_log_path = os.path.join(log_dir, "debug.log")
    debug_handler = RotatingFileHandler(
        debug_log_path, maxBytes=10*1024*1024, backupCount=5, encoding='utf-8' # 10MB
    )
    debug_handler.setLevel(logging.DEBUG)
    debug_handler.setFormatter(formatter)
    logger.addHandler(debug_handler)

    # 3. Error File Handler (Rotating)
    error_log_path = os.path.join(log_dir, "error.log")
    error_handler = RotatingFileHandler(
        error_log_path, maxBytes=10*1024*1024, backupCount=5, encoding='utf-8' # 10MB
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    logger.addHandler(error_handler)
    
    logging.info(f"Logging configured. Logs writing to {log_dir}")
