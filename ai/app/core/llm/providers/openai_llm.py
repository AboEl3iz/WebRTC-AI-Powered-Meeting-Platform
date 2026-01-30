import os
from openai import OpenAI, AsyncOpenAI
from app.core.llm.base import BaseLLM

class OpenAILLM(BaseLLM):
    def __init__(self, model: str = "gpt-4o-mini", api_key: str = None):
        self.model = model
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY is not set")
        
        self.client = OpenAI(api_key=self.api_key)
        self.aclient = AsyncOpenAI(api_key=self.api_key)

    def generate(self, prompt: str, **kwargs) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            **kwargs
        )
        return response.choices[0].message.content

    async def agenerate(self, prompt: str, **kwargs) -> str:
        response = await self.aclient.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            **kwargs
        )
        return response.choices[0].message.content
