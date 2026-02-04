import logging
from .models import MeetingData
from .tools.notion import NotionTool
from .tools.google_calendar import GoogleCalendarTool

logger = logging.getLogger(__name__)

class MCPProcessor:
    def process(self, data: MeetingData):
        results = []
        
        logger.info(f"Processing meeting summary for {len(data.participants)} participants")
        
        for participant in data.participants:
            user_email = participant.user_email
            integrations = participant.integrations
            
            user_result = {"user_email": user_email, "actions": []}
            
            if not integrations:
                logger.info(f"No integrations found for {user_email}")
                results.append(user_result)
                continue

            # Process Notion
            if integrations.notion:
                try:
                    tool = NotionTool(integrations.notion)
                    # Use a title like "Meeting Summary - [Date]"
                    # For now just use "Meeting Summary" or extract from events if possible
                    title = "Meeting Summary"
                    if data.events and len(data.events) > 0:
                         title += f" - {data.events[0].date}"
                         
                    result = tool.create_meeting_page(title, data.summary, data.text)
                    user_result["actions"].append({"type": "notion", "status": "success", "details": result})
                except Exception as e:
                    logger.error(f"Error processing Notion for {user_email}: {e}")
                    user_result["actions"].append({"type": "notion", "status": "error", "error": str(e)})

            # Process Google Calendar
            if integrations.google_calendar:
                try:
                    tool = GoogleCalendarTool(integrations.google_calendar)
                    result = tool.create_events(data.events)
                    user_result["actions"].append({"type": "calendar", "status": "success", "details": result})
                except Exception as e:
                    logger.error(f"Error processing Calendar for {user_email}: {e}")
                    user_result["actions"].append({"type": "calendar", "status": "error", "error": str(e)})
            
            results.append(user_result)
            
        return results
