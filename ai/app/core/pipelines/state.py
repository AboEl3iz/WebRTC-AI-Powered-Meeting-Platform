from typing import TypedDict, Optional, List, Any

class PipelineState(TypedDict):
    input_path: str
    audio_path: Optional[str]
    clean_audio_path: Optional[str]
    transcript_segments: Optional[Any] # Raw whisper segments
    transcript_text: Optional[str]     # Full text
    summary: Optional[str]
    events: Optional[List[dict]]
    error: Optional[str]
    # AI feature opt-in fields
    meeting_id: Optional[str]
    participants: Optional[List[dict]]           # AI-enabled participants with integrations
    distribution_results: Optional[List[dict]]   # Results from distribute node
