import os
from enum import Enum
from app.core.llm.base import BaseLLM
from app.core.llm.providers.openai_llm import OpenAILLM
from app.core.llm.providers.ollama_llm import OllamaLLM

class LLMProvider(str, Enum):
    OPENAI = "openai"
    OLLAMA = "ollama"

class LLMFactory:
    @staticmethod
    def get_llm(provider: str = None, **kwargs) -> BaseLLM:
        provider = provider or os.getenv("LLM_PROVIDER", "openai")
        
        if provider == LLMProvider.OPENAI:
            return OpenAILLM(**kwargs)
        elif provider == LLMProvider.OLLAMA:
            return OllamaLLM(**kwargs)
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")
