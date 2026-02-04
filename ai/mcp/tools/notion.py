import logging
from ..models import NotionIntegration

logger = logging.getLogger(__name__)

class NotionTool:
    def __init__(self, integration: NotionIntegration):
        self.integration = integration

    def create_meeting_page(self, title: str, summary: str, transcript: str):
        """
        Mock creating a page in Notion.
        """
        logger.info(f"[Mock Notion] Creating page '{title}' in workspace {self.integration.workspace_id}")
        logger.info(f"[Mock Notion] Using token: {self.integration.access_token[:5]}...")
        logger.info(f"[Mock Notion] Summary length: {len(summary)}")
        # In real impl, this would call notion client
        return {"id": "mock-page-id", "url": "https://notion.so/mock-page"}
