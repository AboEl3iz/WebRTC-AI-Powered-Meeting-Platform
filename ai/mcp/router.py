from fastapi import APIRouter, HTTPException
from .models import MeetingData
from .processor import MCPProcessor

router = APIRouter()

@router.post("/distribute")
async def distribute_meeting_info(data: MeetingData):
    processor = MCPProcessor()
    try:
        results = processor.process(data)
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
