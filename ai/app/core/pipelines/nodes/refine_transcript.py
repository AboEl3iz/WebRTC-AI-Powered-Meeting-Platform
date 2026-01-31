from app.core.pipelines.state import PipelineState
from app.core.llm.factory import LLMFactory
import logging

logger = logging.getLogger(__name__)

async def refine_transcript_node(state: PipelineState) -> PipelineState:
    logger.info("--- [Node] Refine Transcript (LLM) ---")
    if state.get("error"):
        return state

    text = state.get("transcript_text")
    if not text:
        logger.warning("No transcript text to refine.")
        return state

    system_instruction = (
        "You are an expert transcriber specialized in Egyptian Arabic dialect (Masri). "
        "You will be given a raw automated transcription that may contain spelling errors, "
        "phonetic misinterpretations, or context errors.\n"
        "Your task is to:\n"
        "1. Correct the spelling and grammar while strictly preserving the Egyptian dialect and meaning.\n"
        "2. Do NOT convert it to Modern Standard Arabic (MSA/Fusha) unless the original speaker was speaking MSA.\n"
        "3. Output ONLY the corrected Arabic text. Do not add any explanations or preambles.\n"
    )
    
    full_prompt = f"{system_instruction}\n\nRaw Transcript:\n{text}"
    
    refined_text = None
    
    # Try Google Gemini first
    try:
        llm = LLMFactory.get_llm(provider="google", model="gemini-2.0-flash")
        refined_text = await llm.agenerate(full_prompt)
        logger.info("Transcript refined successfully using Google Gemini.")
    except Exception as e:
        logger.warning(f"Google Gemini failed: {e}. Falling back to OpenAI...")
        
        # Fallback to OpenAI
        try:
            llm = LLMFactory.get_llm(provider="openai")
            refined_text = await llm.agenerate(full_prompt)
            logger.info("Transcript refined successfully using OpenAI (fallback).")
        except Exception as e2:
            logger.error(f"OpenAI fallback also failed: {e2}")
            return state
    
    if refined_text:
        return {**state, "transcript_text": refined_text.strip()}
    
    return state
