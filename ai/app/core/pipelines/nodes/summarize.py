from app.core.pipelines.state import PipelineState
from app.core.ai.summarizer import Summarizer
from app.core.llm.factory import LLMFactory
import asyncio

async def summarize_node(state: PipelineState) -> PipelineState:
    print("--- [Node] Summarize ---")
    if state.get("error"):
        return state

    try:
        text = state["transcript_text"]
        if not text:
            return {**state, "summary": "No text to summarize."}

        llm = LLMFactory.get_llm()
        summarizer = Summarizer(llm)
        
        summary = await summarizer.summarize(text)
        return {**state, "summary": summary}
    except Exception as e:
        return {**state, "error": f"Summarization Failed: {str(e)}"}
