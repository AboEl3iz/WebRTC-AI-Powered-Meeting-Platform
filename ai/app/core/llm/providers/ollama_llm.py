import os
import requests
import httpx
from app.core.llm.base import BaseLLM

class OllamaLLM(BaseLLM):
    def __init__(self, model: str = "llama3", base_url: str = None):
        self.model = model
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    def generate(self, prompt: str, **kwargs) -> str:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            **kwargs
        }
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            return response.json()["message"]["content"]
        except Exception as e:
            raise RuntimeError(f"Ollama generation failed: {e}")

    async def agenerate(self, prompt: str, **kwargs) -> str:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            **kwargs
        }
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return data["message"]["content"]
            except Exception as e:
                raise RuntimeError(f"Ollama async generation failed: {e}")
