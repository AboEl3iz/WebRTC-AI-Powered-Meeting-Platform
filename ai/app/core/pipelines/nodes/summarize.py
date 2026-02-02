from app.core.pipelines.state import PipelineState
from app.core.ai.summarizer import Summarizer
from app.core.llm.factory import LLMFactory
import asyncio

import logging

logger = logging.getLogger(__name__)

async def summarize_node(state: PipelineState) -> PipelineState:
    logger.info("--- [Node] Summarize ---")
    if state.get("error"):
        return state

    text = state.get("transcript_text")
    if not text:
        return {**state, "summary": "No text to summarize."}

    # Try primary LLM (OpenAI/Google), fallback to Ollama
    providers_to_try = ["ollama"]
    
    for provider in providers_to_try:
        try:
            logger.info(f"Attempting summarization with {provider}...")
            llm = LLMFactory.get_llm(provider=provider)
            summarizer = Summarizer(llm)
            
            summary = await summarizer.summarize(text)
            logger.info(f"Summarization succeeded with {provider}.")
            return {**state, "summary": summary}
        except Exception as e:
            logger.warning(f"Summarization with {provider} failed: {e}")
            continue
    
    # If all providers fail, log error but don't block pipeline
    logger.error("All summarization providers failed.")
    return {**state, "summary": "Summarization failed - all providers unavailable."}
