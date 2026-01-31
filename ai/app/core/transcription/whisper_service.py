import os
import logging
import torch
import warnings
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

# Filter annoying warnings
warnings.filterwarnings("ignore", category=UserWarning, module="torchaudio")
warnings.filterwarnings("ignore", category=FutureWarning, module="pyannote")

# Robust Monkeypatch for torch.load (PyTorch 2.6+ compatibility)
_original_load = torch.load
def _custom_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _custom_load
logger.info("✅ PyTorch torch.load monkeypatched successfully.")

# Register safe globals for torch.load (PyTorch 2.6+ security)
try:
    from omegaconf import ListConfig, DictConfig
    from omegaconf.base import Container, ContainerMetadata, Node, Metadata
    from omegaconf.basecontainer import BaseContainer
    from omegaconf.nodes import AnyNode, ValueNode, StringNode, IntegerNode, FloatNode, BooleanNode
    import typing
    from collections import defaultdict
    from torch.torch_version import TorchVersion
    
    pyannote_classes = []
    try:
        from pyannote.audio.core.model import Introspection, Model
        pyannote_classes.extend([Introspection, Model])
    except ImportError:
        pass
    try:
        from pyannote.audio.core.task import Specifications, Problem, Resolution, Task
        pyannote_classes.extend([Specifications, Problem, Resolution, Task])
    except ImportError:
        pass
    
    safe_classes = [
        ListConfig, DictConfig, Container, ContainerMetadata, Node, Metadata,
        BaseContainer, AnyNode, ValueNode, StringNode, IntegerNode, FloatNode, BooleanNode,
        typing.Any, list, dict, set, tuple, defaultdict, int, str, bool, float, bytes,
        TorchVersion,
    ] + pyannote_classes
    
    if hasattr(torch.serialization, 'add_safe_globals'):
        torch.serialization.add_safe_globals([c for c in safe_classes if c is not None])
        logger.info(f"✅ Registered {len(safe_classes)} globals as safe for torch.load")
except Exception as e:
    logger.warning(f"⚠️ Safe globals registration failed: {e}")


# ============================================================================
# ABSTRACT BASE
# ============================================================================
class TranscriptionBackend(ABC):
    """Abstract base for transcription backends."""
    
    @abstractmethod
    def load_model(self):
        pass
    
    @abstractmethod
    def transcribe(self, audio_path: str, batch_size: int = 16) -> dict:
        pass


# ============================================================================
# WHISPERX BACKEND
# ============================================================================
class WhisperXBackend(TranscriptionBackend):
    """WhisperX-based transcription (original implementation)."""
    
    def __init__(self, device: str = None, compute_type: str = "int8", model_size: str = "base", language: str = "ar"):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.compute_type = compute_type
        self.model_size = model_size
        self.language = language
        self.model = None

    def load_model(self):
        if not self.model:
            import whisperx
            logger.info(f"Loading WhisperX model '{self.model_size}' (Language: {self.language}) on {self.device}...")
            self.model = whisperx.load_model(
                self.model_size, 
                self.device, 
                compute_type=self.compute_type,
                language=self.language
            )

    def transcribe(self, audio_path: str, batch_size: int = 16) -> dict:
        import whisperx
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        self.load_model()
        audio = whisperx.load_audio(audio_path)
        logger.info(f"🔥 WhisperX transcribing with language={self.language}")
        result = self.model.transcribe(audio, batch_size=batch_size, language=self.language)
        logger.info("✅ WhisperX Transcription Completed.")
        return result


# ============================================================================
# FASTER-WHISPER BACKEND
# ============================================================================
class FasterWhisperBackend(TranscriptionBackend):
    """
    Faster-Whisper backend.
    
    For Egyptian Arabic, you can either:
    1. Use 'large-v3' which handles dialects better
    2. Convert an Egyptian model to CTranslate2 format:
       ct2-transformers-converter --model MAdel121/whisper-medium-egy \
           --output_dir whisper-medium-egy-ct2 --quantization float16
       Then set EGYPTIAN_ARABIC_MODEL=./whisper-medium-egy-ct2
    """
    
    def __init__(self, device: str = None, compute_type: str = "int8", model_id: str = None, language: str = "ar"):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.compute_type = compute_type
        # Default to 'large-v3' for better Arabic dialect support, or use env var
        self.model_id = model_id or os.getenv("EGYPTIAN_ARABIC_MODEL", "large-v3")
        self.language = language
        self.model = None

    def load_model(self):
        if not self.model:
            from faster_whisper import WhisperModel
            logger.info(f"Loading Faster-Whisper model '{self.model_id}' on {self.device}...")
            self.model = WhisperModel(
                self.model_id,
                device=self.device,
                compute_type=self.compute_type
            )

    def transcribe(self, audio_path: str, batch_size: int = 16) -> dict:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        self.load_model()
        logger.info(f"🔥 Faster-Whisper transcribing (Egyptian Arabic model)")
        
        segments, info = self.model.transcribe(audio_path, language=self.language, beam_size=5)
        
        # Convert to whisperx-compatible format
        segment_list = []
        full_text_parts = []
        for seg in segments:
            segment_list.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip()
            })
            full_text_parts.append(seg.text.strip())
        
        result = {
            "segments": segment_list,
            "language": info.language,
            "text": " ".join(full_text_parts)
        }
        logger.info("✅ Faster-Whisper Transcription Completed.")
        return result


# ============================================================================
# WHISPER SERVICE (FACTORY)
# ============================================================================
class WhisperService:
    """
    Main transcription service that delegates to the configured backend.
    Backend is selected via TRANSCRIPTION_BACKEND env var.
    """
    
    def __init__(self, device: str = None, compute_type: str = "int8"):
        backend_type = os.getenv("TRANSCRIPTION_BACKEND", "faster-whisper").lower()
        
        if backend_type == "faster-whisper":
            logger.info("📌 Using Faster-Whisper backend (Egyptian Arabic)")
            self.backend = FasterWhisperBackend(device=device, compute_type=compute_type)
        else:
            logger.info("📌 Using WhisperX backend")
            self.backend = WhisperXBackend(device=device, compute_type=compute_type)

    def load_model(self, model_size: str = "base", language: str = "ar"):
        """Load model (for compatibility with existing code)."""
        if hasattr(self.backend, 'model_size'):
            self.backend.model_size = model_size
        if hasattr(self.backend, 'language'):
            self.backend.language = language
        self.backend.load_model()

    def transcribe(self, audio_path: str, batch_size: int = 16) -> dict:
        """Transcribe audio using the configured backend."""
        return self.backend.transcribe(audio_path, batch_size=batch_size)