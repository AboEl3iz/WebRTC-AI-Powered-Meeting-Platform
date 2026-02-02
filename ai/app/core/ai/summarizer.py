from typing import List
from app.core.llm.base import BaseLLM

class Summarizer:
    def __init__(self, llm: BaseLLM):
        self.llm = llm

    async def summarize(self, text: str, max_chunk_size: int = 15000) -> str:
        """
        Summarizes the given text. Handles large texts by chunking.
        """
        if len(text) <= max_chunk_size:
            return await self._summarize_chunk(text)
        
        chunks = self._split_text(text, max_chunk_size)
        chunk_summaries = []
        for chunk in chunks:
            summary = await self._summarize_chunk(chunk)
            chunk_summaries.append(summary)
        
        # Merge summaries
        combined_text = "\n".join(chunk_summaries)
        final_summary = await self._summarize_chunk(
            combined_text, 
            instruction="Combine these section summaries into a cohesive meeting summary."
        )
        return final_summary

    async def _summarize_chunk(self, text: str, instruction: str = None) -> str:
        default_instruction = (
            "Summarize the following meeting transcript. "
            "Focus on key decisions, action items, and important discussions. "
            "Keep it concise and structured.",
            "summarize the following text in 5 sentences"
            
        )
        prompt = f"{instruction or default_instruction}\n\nTranscript:\n{text}"
        return await self.llm.agenerate(prompt)

    def _split_text(self, text: str, chunk_size: int) -> List[str]:
        # Simple splitting by character count for now. 
        # Ideally, split by newlines or paragraphs to respect boundaries.
        return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]
