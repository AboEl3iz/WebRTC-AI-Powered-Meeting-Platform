import os
import asyncio
from google import genai
from app.core.llm.base import BaseLLM

class GoogleLLM(BaseLLM):
    """
    Google Gemini access via the official google-genai SDK.
    Docs: https://ai.google.dev/gemini-api/docs/text-generation
    """
    def __init__(self, model: str = "gemini-2.0-flash", api_key: str = None):
        self.model = model
        # Using GOOGLE_STADIO_AI as the key source per user env
        self.api_key = api_key or os.getenv("GOOGLE_STADIO_AI") or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_STADIO_AI (or GOOGLE_API_KEY) is not set")
        
        self.client = genai.Client(api_key=self.api_key)

    def generate(self, prompt: str, **kwargs) -> str:
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            **kwargs
        )
        return response.text

    async def agenerate(self, prompt: str, **kwargs) -> str:
        # google-genai doesn't have native async, so we use run_in_executor
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self.generate(prompt, **kwargs))
