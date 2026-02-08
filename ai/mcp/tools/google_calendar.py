import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from dateutil import parser as date_parser
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from ..models import GoogleCalendarIntegration, Event

logger = logging.getLogger(__name__)


class GoogleCalendarTool:
    """Tool for creating calendar events in Google Calendar."""
    
    def __init__(self, integration: GoogleCalendarIntegration):
        self.integration = integration
        self.service = self._build_service()

    def _build_service(self):
        """Build the Google Calendar API service with the provided credentials."""
        credentials = Credentials(
            token=self.integration.access_token,
            refresh_token=self.integration.refresh_token,
            # These are needed for token refresh but we may not have them
            # In production, you'd store these or use a service account
            token_uri="https://oauth2.googleapis.com/token",
            client_id=None,
            client_secret=None,
        )
        
        return build('calendar', 'v3', credentials=credentials)

    def create_events(self, events: List[Event]) -> List[Dict[str, Any]]:
        """
        Create calendar events from the provided event list.
        
        Returns a list of created event details with IDs and links.
        """
        created_events = []
        
        for event in events:
            try:
                result = self._create_single_event(event)
                created_events.append({
                    "id": result["id"],
                    "summary": result["summary"],
                    "htmlLink": result.get("htmlLink", ""),
                    "status": "success"
                })
                logger.info(f"[Calendar] Created event '{event.title}' with ID: {result['id']}")
            except HttpError as e:
                logger.error(f"[Calendar] HTTP error creating event '{event.title}': {e}")
                created_events.append({
                    "summary": event.title,
                    "status": "error",
                    "error": str(e)
                })
            except Exception as e:
                logger.error(f"[Calendar] Error creating event '{event.title}': {e}")
                created_events.append({
                    "summary": event.title,
                    "status": "error",
                    "error": str(e)
                })
        
        return created_events

    def _create_single_event(self, event: Event) -> Dict[str, Any]:
        """Create a single calendar event."""
        # Parse the event date
        start_datetime = self._parse_event_date(event.date)
        
        # Default event duration: 1 hour
        end_datetime = start_datetime + timedelta(hours=1)
        
        # Build the event body
        event_body = {
            "summary": event.title,
            "start": self._format_datetime(start_datetime),
            "end": self._format_datetime(end_datetime),
        }
        
        # Add attendees if participants are specified
        if event.participants:
            event_body["attendees"] = [
                {"email": email} for email in event.participants
            ]
        
        # Add description
        event_body["description"] = f"Created automatically from meeting summary.\n\nParticipants: {', '.join(event.participants) if event.participants else 'N/A'}"
        
        # Create the event
        result = self.service.events().insert(
            calendarId=self.integration.calendar_id,
            body=event_body,
            sendUpdates="all" if event.participants else "none"
        ).execute()
        
        return result

    def _parse_event_date(self, date_str: str) -> datetime:
        """Parse event date string to datetime object."""
        try:
            # Try parsing with dateutil for flexibility
            return date_parser.parse(date_str)
        except Exception:
            # Fallback to common formats
            for fmt in ["%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"]:
                try:
                    dt = datetime.strptime(date_str, fmt)
                    # If only date provided, set to 10:00 AM
                    if fmt == "%Y-%m-%d":
                        dt = dt.replace(hour=10, minute=0)
                    return dt
                except ValueError:
                    continue
            
            # If all parsing fails, use current date + 1 day at 10:00 AM
            logger.warning(f"[Calendar] Could not parse date '{date_str}', using tomorrow at 10:00 AM")
            return datetime.now().replace(hour=10, minute=0, second=0) + timedelta(days=1)

    def _format_datetime(self, dt: datetime) -> Dict[str, str]:
        """Format datetime for Google Calendar API."""
        # If the datetime has timezone info, use dateTime format
        # Otherwise, use dateTime with timezone offset
        return {
            "dateTime": dt.isoformat(),
            "timeZone": "UTC"  # Default to UTC, could be made configurable
        }
