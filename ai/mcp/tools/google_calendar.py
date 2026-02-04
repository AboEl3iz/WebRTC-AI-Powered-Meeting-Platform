import logging
from typing import List
from ..models import GoogleCalendarIntegration, Event

logger = logging.getLogger(__name__)

class GoogleCalendarTool:
    def __init__(self, integration: GoogleCalendarIntegration):
        self.integration = integration

    def create_events(self, events: List[Event]):
        """
        Mock creating events in Google Calendar.
        """
        created_events = []
        for event in events:
            logger.info(f"[Mock Calendar] Creating event '{event.title}' on {event.date}")
            logger.info(f"[Mock Calendar] Using token: {self.integration.access_token[:5]}...")
            created_events.append({"id": "mock-event-id", "summary": event.title})
        return created_events
