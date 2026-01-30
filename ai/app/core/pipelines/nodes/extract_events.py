from app.core.pipelines.state import PipelineState
from app.core.ai.event_extractor import EventExtractor
from app.core.llm.factory import LLMFactory

async def extract_events_node(state: PipelineState) -> PipelineState:
    print("--- [Node] Extract Events ---")
    if state.get("error"):
        return state

    try:
        text = state["transcript_text"]
        
        llm = LLMFactory.get_llm()
        extractor = EventExtractor(llm)
        
        # EventExtractor already has heuristics check inside, but we can also rely on graph edge.
        # Here we just call it.
        result = await extractor.extract(text)
        events = result.get("events", [])
        
        return {**state, "events": events}
    
    except Exception as e:
        # We don't fail the whole pipeline if event extraction fails, just log/store error?
        # Or maybe we do want to store it in state
        print(f"Event extraction warning: {e}")
        return {**state, "events": []}
