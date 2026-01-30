from app.core.llm.base import BaseLLM
from app.core.ai.event_heuristics import EventHeuristics
import json

class EventExtractor:
    def __init__(self, llm: BaseLLM):
        self.llm = llm

    async def extract(self, text: str) -> dict:
        """
        Extract structured event data from text using LLM.
        """
        # Pre-check heuristics to save tokens
        if not EventHeuristics.should_extract_events(text):
            return {"events": []}

        prompt = (
            "Analyze the following text and extract any scheduled meetings or events. "
            "Return the result as a strictly valid JSON object with a key 'events' which is a list. "
            "Each event object should have: 'title', 'date' (YYYY-MM-DD), 'time', 'attendees' (list), and 'description'. "
            "If no date/time is mentioned, use null. "
            "Output ONLY JSON.\n\n"
            f"Text:\n{text}"
        )

        response = await self.llm.agenerate(prompt)
        
        # Basic cleanup if the model creates markdown code blocks
        clean_response = response.replace("```json", "").replace("```", "").strip()
        
        try:
            return json.loads(clean_response)
        except json.JSONDecodeError:
            # Fallback or error handling
            # In a real app, we might retry or use a parser
            return {"error": "Failed to parse JSON", "raw_output": response}
