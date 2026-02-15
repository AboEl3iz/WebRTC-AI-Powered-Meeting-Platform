"""
MinIO / S3-compatible storage client for the AI service.
Used to download recordings that were uploaded by the backend.
"""
import os
import logging
import boto3
from botocore.client import Config

logger = logging.getLogger(__name__)

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "karim123")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "karim123")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "recordings")


def get_s3_client():
    """Create and return a boto3 S3 client configured for MinIO."""
    return boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def download_recording(bucket: str, key: str, local_path: str) -> str:
    """
    Download a recording from MinIO/S3 to a local path.
    Returns the local file path.
    """
    os.makedirs(os.path.dirname(local_path), exist_ok=True)

    client = get_s3_client()

    logger.info(f"Downloading s3://{bucket}/{key} -> {local_path}")
    client.download_file(bucket, key, local_path)
    logger.info(f"Download complete: {local_path}")

    return local_path
