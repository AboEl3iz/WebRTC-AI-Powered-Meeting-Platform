from app.core.logging_config import setup_logging
# Setup logging immediately to capture early patch logs
setup_logging()

import early_patch
import uvicorn
from fastapi import FastAPI
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from api.routes import process

from mcp.router import router as mcp_router
# Load env
load_dotenv()

import logging
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    try:
        from app.core.messaging.consumer import start_consumer
        await start_consumer()
        logger.info("RabbitMQ consumer started successfully")
    except Exception as e:
        logger.error(f"Failed to start RabbitMQ consumer: {e}")
        logger.warning("AI service running without RabbitMQ — only manual /process endpoint available")
    
    yield
    
    # Shutdown
    try:
        from app.core.messaging.rabbitmq import close_connection
        await close_connection()
        logger.info("RabbitMQ connection closed")
    except Exception as e:
        logger.error(f"Error closing RabbitMQ connection: {e}")


app = FastAPI(title="AI Meeting Summarizer", lifespan=lifespan)

app.include_router(process.router, prefix="/api/v1")
app.include_router(mcp_router, prefix="/api/v1/mcp")

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Meeting Summarizer API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)