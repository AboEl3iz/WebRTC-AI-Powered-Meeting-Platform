from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from app.core.pipelines.graph import create_pipeline
from app.core.pipelines.state import PipelineState
import shutil
import os
import uuid
import json
from typing import Optional

router = APIRouter()
pipeline = create_pipeline()

OUTPUT_DIR = "output"
INPUT_DIR = "input"
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(INPUT_DIR, exist_ok=True)

# In-memory store for results (use DB in production)
results_store = {}

import logging

logger = logging.getLogger(__name__)

async def run_pipeline_task(task_id: str, file_path: str, participants: list | None = None):
    logger.info(f"Starting pipeline for task {task_id}")
    try:
        initial_state: PipelineState = {
            "input_path": file_path,
            "audio_path": None,
            "clean_audio_path": None,
            "transcript_segments": None,
            "transcript_text": None,
            "summary": None,
            "events": None,
            "error": None,
            "meeting_id": task_id,
            "participants": participants,
            "distribution_results": None,
        }
        
        final_state = await pipeline.ainvoke(initial_state)
        
        # Save results to disk
        output_file = os.path.join(OUTPUT_DIR, f"{task_id}.json")
        
        result_data = {
            "summary": final_state.get("summary"),
            "events": final_state.get("events"),
            "text": final_state.get("transcript_text"),
            "distribution_results": final_state.get("distribution_results"),
            "error": final_state.get("error")
        }
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2)
            
        results_store[task_id] = {"status": "completed", "result": result_data}
        logger.info(f"Pipeline finished for {task_id}")
        
    except Exception as e:
        logger.error(f"Pipeline crashed for {task_id}: {e}", exc_info=True)
        results_store[task_id] = {"status": "failed", "error": str(e)}

@router.post("/process")
async def process_file(
    file: UploadFile = File(...),
    participants: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = None,
):
    """
    Process a video file with the AI pipeline.
    
    Optional `participants` JSON string containing AI-enabled participant integrations:
    [
        {
            "user_email": "user@example.com",
            "integrations": {
                "notion": { "access_token": "...", "workspace_id": "..." },
                "google_calendar": { "access_token": "...", "refresh_token": "..." }
            }
        }
    ]
    
    If participants are provided, the pipeline will distribute results to their services.
    If not, the pipeline runs normally without distribution (backward compatible).
    """
    try:
        task_id = str(uuid.uuid4())
        # Use simple file extension handling or default to nothing if missing
        filename = file.filename or "file"
        file_ext = os.path.splitext(filename)[1]
        input_path = os.path.join(INPUT_DIR, f"{task_id}{file_ext}")
        
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        results_store[task_id] = {"status": "processing"}
        
        # Parse participants JSON if provided
        parsed_participants = None
        if participants:
            try:
                parsed_participants = json.loads(participants)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid participants JSON")
        
        # Start background task
        background_tasks.add_task(run_pipeline_task, task_id, input_path, parsed_participants)
        
        return {"task_id": task_id, "status": "processing"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{task_id}")
async def get_status(task_id: str):
    if task_id not in results_store:
        raise HTTPException(status_code=404, detail="Task not found")
    return results_store[task_id]
