"""
RabbitMQ connection management for the AI service.
"""
import os
import logging
import aio_pika

logger = logging.getLogger(__name__)

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672")

_connection: aio_pika.abc.AbstractRobustConnection | None = None
_channel: aio_pika.abc.AbstractChannel | None = None


async def get_connection() -> aio_pika.abc.AbstractRobustConnection:
    """Get or create a robust RabbitMQ connection."""
    global _connection
    if _connection is None or _connection.is_closed:
        logger.info(f"Connecting to RabbitMQ at {RABBITMQ_URL}")
        _connection = await aio_pika.connect_robust(RABBITMQ_URL)
        logger.info("RabbitMQ connected")
    return _connection


async def get_channel() -> aio_pika.abc.AbstractChannel:
    """Get or create a RabbitMQ channel."""
    global _channel
    connection = await get_connection()
    if _channel is None or _channel.is_closed:
        _channel = await connection.channel()
        await _channel.set_qos(prefetch_count=1)  # Process one message at a time
    return _channel


async def close_connection():
    """Close the RabbitMQ connection gracefully."""
    global _connection, _channel
    if _channel and not _channel.is_closed:
        await _channel.close()
        _channel = None
    if _connection and not _connection.is_closed:
        await _connection.close()
        _connection = None
    logger.info("RabbitMQ connection closed")
