import logging
from typing import Optional, Dict, Any, List
from notion_client import Client
from notion_client.errors import APIResponseError
from ..models import NotionIntegration

logger = logging.getLogger(__name__)


class NotionTool:
    """Tool for creating meeting summary pages in Notion."""
    
    def __init__(self, integration: NotionIntegration):
        self.integration = integration
        self.client = Client(auth=integration.access_token)

    def create_meeting_page(self, title: str, summary: str, transcript: str) -> Dict[str, Any]:
        """
        Create a page in Notion with the meeting summary.
        
        If database_id is provided, creates a page in that database.
        Otherwise, creates a page in the workspace.
        """
        try:
            # Build the page content blocks
            children_blocks = self._build_content_blocks(summary, transcript)
            
            if self.integration.database_id:
                # Create as a database entry
                page = self._create_database_page(title, children_blocks)
            else:
                # Create as a standalone page in workspace
                page = self._create_workspace_page(title, children_blocks)
            
            logger.info(f"[Notion] Successfully created page '{title}' with ID: {page['id']}")
            return {
                "id": page["id"],
                "url": page.get("url", f"https://notion.so/{page['id'].replace('-', '')}")
            }
            
        except APIResponseError as e:
            logger.error(f"[Notion] API error creating page: {e.code} - {e.message}")
            raise Exception(f"Notion API error: {e.message}")
        except Exception as e:
            logger.error(f"[Notion] Error creating page: {e}")
            raise

    def _create_database_page(self, title: str, children_blocks: List[Dict]) -> Dict[str, Any]:
        """Create a page as an entry in a Notion database."""
        logger.info(f"[Notion] Creating database entry in database {self.integration.database_id}")
        
        page = self.client.pages.create(
            parent={"database_id": self.integration.database_id},
            properties={
                "title": {
                    "title": [{"text": {"content": title}}]
                }
            },
            children=children_blocks
        )
        return page

    def _create_workspace_page(self, title: str, children_blocks: List[Dict]) -> Dict[str, Any]:
        """Create a standalone page in the workspace."""
        logger.info(f"[Notion] Creating workspace page in workspace {self.integration.workspace_id}")
        
        # For workspace pages, we need a parent page ID or database ID
        # If only workspace_id is provided, we'll try to use it as a page parent
        # This requires the workspace_id to actually be a page ID
        page = self.client.pages.create(
            parent={"page_id": self.integration.workspace_id},
            properties={
                "title": {
                    "title": [{"text": {"content": title}}]
                }
            },
            children=children_blocks
        )
        return page

    def _build_content_blocks(self, summary: str, transcript: str) -> List[Dict[str, Any]]:
        """Build Notion block content for the meeting page."""
        blocks = []
        
        # Summary heading
        blocks.append({
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "📋 Meeting Summary"}}]
            }
        })
        
        # Summary content - split into paragraphs
        summary_paragraphs = summary.split('\n')
        for para in summary_paragraphs:
            if para.strip():
                blocks.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": para.strip()}}]
                    }
                })
        
        # Divider
        blocks.append({
            "object": "block",
            "type": "divider",
            "divider": {}
        })
        
        # Transcript heading
        blocks.append({
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": "📝 Full Transcript"}}]
            }
        })
        
        # Transcript content in a toggle block for collapsibility
        # Notion has a 2000 character limit per rich_text block, so we chunk the transcript
        transcript_chunks = self._chunk_text(transcript, 1900)
        
        blocks.append({
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "Click to expand transcript"}}],
                "children": [
                    {
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"type": "text", "text": {"content": chunk}}]
                        }
                    }
                    for chunk in transcript_chunks
                ]
            }
        })
        
        return blocks

    def _chunk_text(self, text: str, max_length: int = 1900) -> List[str]:
        """Split text into chunks that fit Notion's character limits."""
        if len(text) <= max_length:
            return [text]
        
        chunks = []
        current_chunk = ""
        
        for word in text.split():
            if len(current_chunk) + len(word) + 1 <= max_length:
                current_chunk += (" " if current_chunk else "") + word
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = word
        
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
