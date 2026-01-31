import torch
import logging

logger = logging.getLogger(__name__)

_original_load = torch.load
import os

logger.info(f"Applying early patch for PyTorch compatibility (weights_only=False)...")

_original_load = torch.load

def _custom_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)

torch.load = _custom_load
logger.info("PyTorch torch.load monkeypatched successfully.")
