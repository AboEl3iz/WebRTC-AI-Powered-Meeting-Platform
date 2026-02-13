import os
import requests
import httpx
from app.core.llm.base import BaseLLM

class OllamaLLM(BaseLLM):
    def __init__(self, model: str = "gemma2:9b", base_url: str = None):
        self.model = model
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "https://pixilated-heterogenetically-sherly.ngrok-free.dev")

    def generate(self, prompt: str, **kwargs) -> str:
        url = f"{self.base_url}/chat"
        headers = {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true"  # Required for ngrok free tier
        }
        # FastAPI wrapper expects {"message": "...", "history": [...]}
        payload = {
            "message": prompt,
            "history": []
        }
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=120)
            response.raise_for_status()
            return response.json()["reply"]
        except Exception as e:
            raise RuntimeError(f"Ollama generation failed: {e}")

    async def agenerate(self, prompt: str, **kwargs) -> str:
        url = f"{self.base_url}/chat"
        headers = {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true"  # Required for ngrok free tier
        }
        # FastAPI wrapper expects {"message": "...", "history": [...]}
        payload = {
            "message": prompt,
            "history": []
        }
        async with httpx.AsyncClient(timeout=120) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
                return data["reply"]
            except Exception as e:
                raise RuntimeError(f"Ollama async generation failed: {e}")
