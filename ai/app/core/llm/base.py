from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any

class BaseLLM(ABC):
    """
    Abstract base class for LLM providers.
    """

    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> str:
        """
        Synchronous generation of text from a prompt.
        """
        pass

    @abstractmethod
    async def agenerate(self, prompt: str, **kwargs) -> str:
        """
        Asynchronous generation of text from a prompt.
        """
        pass
