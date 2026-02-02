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
        "You are an expert transcriber specialized "
        # "in Egyptian Arabic dialect (Masri). "
        "You will be given a raw automated transcription that may contain spelling errors, "
        "phonetic misinterpretations, or context errors.\n"
        "Your task is to:\n"
        "1. Correct the spelling and grammar while strictly" 
        # preserving the Egyptian dialect and meaning.\n"
        # "2. Do NOT convert it to Modern Standard Arabic (MSA/Fusha) unless the original speaker was speaking MSA.\n"
        "3. Output ONLY the corrected English text. Do not add any explanations or preambles.\n"
    )
    
    full_prompt = f"{system_instruction}\n\nRaw Transcript:\n{text}"
    
    try:
        llm = LLMFactory.get_llm(provider="ollama")
        refined_text = await llm.agenerate(full_prompt)
        logger.info("Transcript refined successfully using ollama.")
        return {**state, "transcript_text": refined_text.strip()}
    except Exception as e:
        logger.error(f"ollama refinement failed: {e}")
        return state

