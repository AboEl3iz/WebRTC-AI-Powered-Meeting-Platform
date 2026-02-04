from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class NotionIntegration(BaseModel):
    access_token: str
    workspace_id: str
    database_id: Optional[str] = None

class GoogleCalendarIntegration(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    calendar_id: str = "primary"

class Integrations(BaseModel):
    notion: Optional[NotionIntegration] = None
    google_calendar: Optional[GoogleCalendarIntegration] = None

class Participant(BaseModel):
    user_email: str
    integrations: Optional[Integrations] = None

class Event(BaseModel):
    title: str
    date: str
    participants: Optional[List[str]] = None

class MeetingData(BaseModel):
    summary: str
    events: List[Event]
    text: str
    participants: List[Participant]
