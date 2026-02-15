import logging
from app.core.pipelines.state import PipelineState
from mcp.processor import MCPProcessor
from mcp.models import MeetingData, Participant, Integrations, NotionIntegration, GoogleCalendarIntegration, Event

logger = logging.getLogger(__name__)


def distribute_node(state: PipelineState) -> dict:
    """
    Pipeline node that distributes results to participants' connected services.
    Only processes participants who have AI features enabled (i.e., have integrations).
    No-op if no participants are provided.
    """
    participants_raw = state.get("participants")

    if not participants_raw:
        logger.info("[Distribute] No participants with integrations — skipping distribution")
        return {"distribution_results": None}

    summary = state.get("summary", "")
    events_raw = state.get("events", [])
    text = state.get("transcript_text", "")

    if not summary:
        logger.warning("[Distribute] No summary available — skipping distribution")
        return {"distribution_results": None}

    # Build Event models from raw dicts
    events = []
    if events_raw:
        for e in events_raw:
            events.append(Event(
                title=e.get("title", "Untitled Event"),
                date=e.get("date", ""),
                participants=e.get("participants")
            ))

    # Build Participant models
    participants = []
    for p in participants_raw:
        integrations_data = p.get("integrations", {})
        integrations = None

        if integrations_data:
            notion = None
            gcal = None

            if integrations_data.get("notion"):
                notion = NotionIntegration(
                    access_token=integrations_data["notion"]["access_token"],
                    workspace_id=integrations_data["notion"]["workspace_id"],
                    database_id=integrations_data["notion"].get("database_id")
                )

            if integrations_data.get("google_calendar"):
                gcal = GoogleCalendarIntegration(
                    access_token=integrations_data["google_calendar"]["access_token"],
                    refresh_token=integrations_data["google_calendar"].get("refresh_token"),
                    calendar_id=integrations_data["google_calendar"].get("calendar_id", "primary")
                )

            integrations = Integrations(notion=notion, google_calendar=gcal)

        participants.append(Participant(
            user_email=p.get("user_email", ""),
            integrations=integrations
        ))

    # Build MeetingData and process
    meeting_data = MeetingData(
        summary=summary,
        events=events,
        text=text,
        participants=participants
    )

    logger.info(f"[Distribute] Distributing to {len(participants)} AI-enabled participants")

    processor = MCPProcessor()
    results = processor.process(meeting_data)

    logger.info(f"[Distribute] Distribution complete: {results}")

    return {"distribution_results": results}
