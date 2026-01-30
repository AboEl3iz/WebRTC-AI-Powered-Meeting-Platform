
import whisperx
import torch
import os
import warnings
import logging

# Filter annoying torchaudio warnings
warnings.filterwarnings("ignore", category=UserWarning, module="torchaudio")
warnings.filterwarnings("ignore", category=FutureWarning, module="pyannote")

try:
    from omegaconf import OmegaConf, ListConfig, DictConfig
    from omegaconf import OmegaConf, ListConfig, DictConfig
    from omegaconf.base import Container, ContainerMetadata, Node, Metadata
    from omegaconf.basecontainer import BaseContainer
    # Remove InterpolationValueNode as it caused import error
    from omegaconf.nodes import AnyNode, ValueNode, StringNode, IntegerNode, FloatNode, BooleanNode
    import typing
    from collections import defaultdict
    from torch.torch_version import TorchVersion
    try:
        from pyannote.audio.core.model import Introspection
    except ImportError:
        Introspection = None
        print("⚠️ Could not import pyannote.audio.core.model.Introspection")

    try:
        from pyannote.audio.core.task import Specifications, Problem, Resolution
    except ImportError:
        Specifications = None
        Problem = None
        Resolution = None
        print("⚠️ Could not import pyannote.audio.core.task.Specifications or Problem or Resolution")
    
    # Register ALL omegaconf globals as safe for torch.load (PyTorch 2.6+ security)
    # Pyannote uses various omegaconf classes in its checkpoints
    safe_classes = [
        ListConfig, 
        DictConfig, 
        Container, 
        ContainerMetadata, 
        Node,
        Metadata,
        BaseContainer,
        typing.Any,
        list,
        dict,
        set,
        tuple,
        defaultdict,
        int,
        str,
        bool,
        float,
        bytes,
        AnyNode, 
        ValueNode, 
        StringNode, 
        IntegerNode, 
        FloatNode, 
        BooleanNode,
        TorchVersion,
        Introspection,
        Specifications,
        Problem,
        Resolution
    ]
    # Filter out None values (failed imports)
    safe_classes = [c for c in safe_classes if c is not None]
    
    torch.serialization.add_safe_globals(safe_classes)
    print(f"✅ Registered {len(safe_classes)} OmegaConf globals for safe usage.")
except ImportError as e:
    print(f"⚠️ OmegaConf import failed: {e}, relying on monkeypatch.")
except AttributeError:
    print("⚠️ torch.serialization.add_safe_globals not found (older torch?), skipping.")

# Robust Monkeypatch for torch.load
# We force it even if it looks patched, just in case.
_original_load = torch.load
def _custom_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _custom_load

class WhisperService:
    def __init__(self, device: str = None, compute_type: str = "int8"):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.compute_type = compute_type
        self.model = None

    def load_model(self, model_size: str = "base", language: str = "en"):
        if not self.model:
            print(f"Loading WhisperX model '{model_size}' (Language: {language}) on {self.device}...")
            self.model = whisperx.load_model(
                model_size, 
                self.device, 
                compute_type=self.compute_type,
                language=language 
            )

    def transcribe(self, audio_path: str, batch_size: int = 16) -> dict:
        """
        Transcribes audio and returns the result dictionary.
        Keys: 'segments', 'language', 'text'
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        self.load_model()
        
        audio = whisperx.load_audio(audio_path)
        print("🔥 USING ENGLISH MODE for Transcription")
        result = self.model.transcribe(audio, batch_size=batch_size, language="en")
        print("✅ WhisperX Transcription Completed.")
        
        # Look for alignment models if needed later, 
        # but for now basic transcription is fine.
        return result

        