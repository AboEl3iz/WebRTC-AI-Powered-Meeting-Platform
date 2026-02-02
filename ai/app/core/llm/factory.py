import os
from enum import Enum
from app.core.llm.base import BaseLLM
from app.core.llm.providers.openai_llm import OpenAILLM
from app.core.llm.providers.ollama_llm import OllamaLLM
from app.core.llm.providers.google_llm import GoogleLLM

class LLMProvider(str, Enum):
    OPENAI = "openai"
    OLLAMA = "ollama"
    GOOGLE = "google"

class LLMFactory:
    @staticmethod
    def get_llm(provider: str = None, **kwargs) -> BaseLLM:
        provider = provider or os.getenv("LLM_PROVIDER", "ollama")
        
        if provider == LLMProvider.OPENAI:
            return OpenAILLM(**kwargs)
        elif provider == LLMProvider.OLLAMA:
            return OllamaLLM(**kwargs)
        elif provider == LLMProvider.GOOGLE:
            return GoogleLLM(**kwargs)
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")
