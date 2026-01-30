from app.core.pipelines.state import PipelineState
from app.core.audio.extractor import AudioExtractor

def extract_audio_node(state: PipelineState) -> PipelineState:
    print("--- [Node] Extract Audio ---")
    try:
        input_path = state["input_path"]
        # If input is already audio (wav/mp3), extractor might just copy or return it
        # Assuming Extractor handles validation
        audio_path = AudioExtractor.extract(input_path)
        return {**state, "audio_path": audio_path}
    except Exception as e:
        return {**state, "error": f"Audio Extraction Failed: {str(e)}"}
