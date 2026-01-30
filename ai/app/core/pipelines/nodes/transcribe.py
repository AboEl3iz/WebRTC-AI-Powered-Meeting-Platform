from app.core.pipelines.state import PipelineState
from app.core.transcription.whisper_service import WhisperService

# Instantiate service globally or pass via config
# For simplicity, we instantiate here (re-loading model potentially, but WhisperService has lazy load check)
whisper_service = WhisperService()

def transcribe_node(state: PipelineState) -> PipelineState:
    print("--- [Node] Transcribe ---")
    if state.get("error"):
        return state

    try:
        audio_path = state["clean_audio_path"] or state["audio_path"]
        result = whisper_service.transcribe(audio_path)
        print("FULL RESULT:", result)
        print("SEGMENTS:", result.get("segments"))
        print("TEXT LENGTH:", len(result.get("text", "")))
        
        # Combine segments into full text
        segments = result.get("segments", [])
        full_text = " ".join([seg.get("text", "") for seg in segments])
        
        return {
            **state, 
            "transcript_segments": segments, 
            "transcript_text": full_text
        }
    except Exception as e:
        return {**state, "error": f"Transcription Failed: {str(e)}"}
