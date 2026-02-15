from langgraph.graph import StateGraph, END
from app.core.pipelines.state import PipelineState
from app.core.pipelines.nodes.extract_audio import extract_audio_node
from app.core.pipelines.nodes.clean_audio import clean_audio_node
from app.core.pipelines.nodes.transcribe import transcribe_node
from app.core.pipelines.nodes.refine_transcript import refine_transcript_node
from app.core.pipelines.nodes.summarize import summarize_node
from app.core.pipelines.nodes.extract_events import extract_events_node
from app.core.pipelines.nodes.distribute import distribute_node
from app.core.ai.event_heuristics import EventHeuristics

def should_extract_events(state: PipelineState) -> str:
    """
    Conditional edge logic: check simple heuristics on the full text.
    Returns the name of the next node ("extract_events" or "distribute").
    """
    if state.get("error"):
        return "distribute"  # Still try to distribute summary even if events fail
        
    text = state.get("transcript_text", "")
    if EventHeuristics.should_extract_events(text):
        return "extract_events"
    return "distribute"

def create_pipeline():
    workflow = StateGraph(PipelineState)

    # Add Nodes
    workflow.add_node("extract_audio", extract_audio_node)
    workflow.add_node("clean_audio", clean_audio_node)
    workflow.add_node("transcribe", transcribe_node)
    workflow.add_node("refine_transcript", refine_transcript_node)
    workflow.add_node("summarize", summarize_node)
    workflow.add_node("extract_events", extract_events_node)
    workflow.add_node("distribute", distribute_node)

    # Define Edges
    workflow.set_entry_point("extract_audio")
    workflow.add_edge("extract_audio", "clean_audio")
    workflow.add_edge("clean_audio", "transcribe")
    workflow.add_edge("transcribe", "refine_transcript")
    workflow.add_edge("refine_transcript", "summarize")
    
    # Conditional Edge from Summarize -> Extract Events (or Distribute)
    workflow.add_conditional_edges(
        "summarize",
        should_extract_events,
        {
            "extract_events": "extract_events",
            "distribute": "distribute"
        }
    )
    
    # After extract_events, always go to distribute
    workflow.add_edge("extract_events", "distribute")
    
    # Distribute is the final node
    workflow.add_edge("distribute", END)

    return workflow.compile()
