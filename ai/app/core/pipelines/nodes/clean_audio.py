from app.core.pipelines.state import PipelineState
from app.core.audio.cleaner import AudioCleaner

def clean_audio_node(state: PipelineState) -> PipelineState:
    print("--- [Node] Clean Audio ---")
    if state.get("error"):
        return state

    try:
        audio_path = state["audio_path"]
        clean_path = AudioCleaner.clean(audio_path)
        return {**state, "clean_audio_path": clean_path}
    except Exception as e:
        return {**state, "error": f"Audio Cleaning Failed: {str(e)}"}
