import torch
import logging

logger = logging.getLogger(__name__)

_original_load = torch.load

def _custom_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)

torch.load = _custom_load

logger.info("✅ torch.load patched (weights_only=False)")
