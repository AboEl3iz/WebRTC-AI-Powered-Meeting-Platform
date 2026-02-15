"""
RabbitMQ consumer that listens for recording.completed events
and triggers the AI pipeline.
"""
import os
import json
import uuid
import logging
import aio_pika

from app.core.messaging.rabbitmq import get_channel
from app.core.storage.minio_client import download_recording
from app.core.pipelines.graph import create_pipeline
from app.core.pipelines.state import PipelineState

logger = logging.getLogger(__name__)

EXCHANGE_NAME = "meetings"
QUEUE_NAME = "recording.completed"
ROUTING_KEY = "recording.completed"
INPUT_DIR = "input"
OUTPUT_DIR = "output"


async def process_recording_event(message: aio_pika.abc.AbstractIncomingMessage):
    """
    Process a single recording.completed event:
    1. Parse the event payload
    2. Download the video from MinIO
    3. Run the unified AI pipeline (with participants for distribution)
    4. Acknowledge the message
    """
    async with message.process():
        try:
            body = json.loads(message.body.decode())

            meeting_id = body.get("meetingId", "unknown")
            room_id = body.get("roomId", "unknown")
            video_bucket = body.get("videoBucket", "recordings")
            video_key = body.get("videoKey", "")
            participants = body.get("participants", [])

            logger.info(f"Received recording.completed event", extra={
                "meetingId": meeting_id,
                "roomId": room_id,
                "videoKey": video_key,
                "participantCount": len(participants),
            })

            # 1. Download the recording from MinIO
            os.makedirs(INPUT_DIR, exist_ok=True)
            task_id = str(uuid.uuid4())
            local_path = os.path.join(INPUT_DIR, f"{task_id}.mp4")

            download_recording(
                bucket=video_bucket,
                key=video_key,
                local_path=local_path,
            )

            # 2. Run the unified pipeline
            pipeline = create_pipeline()

            initial_state: PipelineState = {
                "input_path": local_path,
                "audio_path": None,
                "clean_audio_path": None,
                "transcript_segments": None,
                "transcript_text": None,
                "summary": None,
                "events": None,
                "error": None,
                "meeting_id": meeting_id,
                "participants": participants,
                "distribution_results": None,
            }

            logger.info(f"Starting pipeline for meeting {meeting_id} (task {task_id})")
            final_state = await pipeline.ainvoke(initial_state)

            # 3. Save results
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            output_file = os.path.join(OUTPUT_DIR, f"{task_id}.json")

            result_data = {
                "meeting_id": meeting_id,
                "room_id": room_id,
                "summary": final_state.get("summary"),
                "events": final_state.get("events"),
                "text": final_state.get("transcript_text"),
                "distribution_results": final_state.get("distribution_results"),
                "error": final_state.get("error"),
            }

            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(result_data, f, ensure_ascii=False, indent=2)

            logger.info(f"Pipeline completed for meeting {meeting_id}", extra={
                "taskId": task_id,
                "hasDistribution": final_state.get("distribution_results") is not None,
            })

        except Exception as e:
            logger.error(f"Error processing recording event: {e}", exc_info=True)
            # Message will be nacked and requeued by aio_pika on exception
            raise


async def start_consumer():
    """
    Start consuming recording.completed events from RabbitMQ.
    This should be called during FastAPI startup.
    """
    channel = await get_channel()

    # Declare exchange and queue
    exchange = await channel.declare_exchange(
        EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True
    )

    queue = await channel.declare_queue(QUEUE_NAME, durable=True)
    await queue.bind(exchange, ROUTING_KEY)

    # Start consuming
    await queue.consume(process_recording_event)

    logger.info(f"RabbitMQ consumer started — listening on queue '{QUEUE_NAME}'")
