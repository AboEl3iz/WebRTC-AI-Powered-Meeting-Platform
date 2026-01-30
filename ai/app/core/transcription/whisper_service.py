import whisperx
import torch
import os
import warnings
import logging

# Filter annoying torchaudio warnings
warnings.filterwarnings("ignore", category=UserWarning, module="torchaudio")
warnings.filterwarnings("ignore", category=FutureWarning, module="pyannote")

# Robust Monkeypatch for torch.load FIRST (before any imports that might use it)
_original_load = torch.load
def _custom_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _custom_load
print("✅ PyTorch torch.load monkeypatched successfully.")

try:
    from omegaconf import OmegaConf, ListConfig, DictConfig
    from omegaconf.base import Container, ContainerMetadata, Node, Metadata
    from omegaconf.basecontainer import BaseContainer
    from omegaconf.nodes import AnyNode, ValueNode, StringNode, IntegerNode, FloatNode, BooleanNode
    import typing
    from collections import defaultdict
    from torch.torch_version import TorchVersion
    
    # Import pyannote classes - these are critical
    pyannote_classes = []
    
    try:
        from pyannote.audio.core.model import Introspection
        pyannote_classes.append(Introspection)
        print("✅ Imported pyannote.audio.core.model.Introspection")
    except ImportError as e:
        print(f"⚠️ Could not import pyannote.audio.core.model.Introspection: {e}")

    try:
        from pyannote.audio.core.task import Specifications, Problem, Resolution
        pyannote_classes.extend([Specifications, Problem, Resolution])
        print(f"✅ Imported pyannote.audio.core.task classes: Specifications, Problem, Resolution")
    except ImportError as e:
        print(f"⚠️ Could not import pyannote.audio.core.task classes: {e}")
    
    # Additional pyannote classes that might be needed
    try:
        from pyannote.audio.core.task import Task
        pyannote_classes.append(Task)
        print("✅ Imported pyannote.audio.core.task.Task")
    except ImportError as e:
        print(f"⚠️ Could not import Task: {e}")
    
    try:
        from pyannote.audio.core.model import Model
        pyannote_classes.append(Model)
        print("✅ Imported pyannote.audio.core.model.Model")
    except ImportError as e:
        print(f"⚠️ Could not import Model: {e}")
    
    # Register ALL omegaconf and pyannote globals as safe for torch.load (PyTorch 2.6+ security)
    safe_classes = [
        # OmegaConf classes
        ListConfig, 
        DictConfig, 
        Container, 
        ContainerMetadata, 
        Node,
        Metadata,
        BaseContainer,
        AnyNode, 
        ValueNode, 
        StringNode, 
        IntegerNode, 
        FloatNode, 
        BooleanNode,
        # Python built-ins
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
        # Torch classes
        TorchVersion,
    ]
    
    # Add pyannote classes
    safe_classes.extend(pyannote_classes)
    
    # Filter out None values (failed imports) - though we shouldn't have any now
    safe_classes = [c for c in safe_classes if c is not None]
    
    # Register with torch
    if hasattr(torch.serialization, 'add_safe_globals'):
        torch.serialization.add_safe_globals(safe_classes)
        print(f"✅ Registered {len(safe_classes)} globals as safe for torch.load")
        print(f"   Including {len(pyannote_classes)} pyannote classes")
    else:
        print("⚠️ torch.serialization.add_safe_globals not available (older PyTorch version)")
        
except ImportError as e:
    print(f"⚠️ Import failed: {e}, relying on monkeypatch only.")
except Exception as e:
    print(f"⚠️ Unexpected error during safe globals registration: {e}")

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
        
        return result