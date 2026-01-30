import os
import ffmpeg

class AudioCleaner:
    @staticmethod
    def clean(input_path: str, output_path: str = None) -> str:
        """
        Cleans audio using basic noise reduction or normalization.
        For now, it converts to 16kHz mono as a 'cleaning' step if not already done,
        or just copies if we treat extraction as the main conversion.
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
            
        if output_path is None:
            base, ext = os.path.splitext(input_path)
            output_path = f"{base}_clean{ext}"

        # Simple pass-through or normalization could go here.
        # Implementation: Simple High-pass filter to remove rumble
        try:
            (
                ffmpeg
                .input(input_path)
                .filter('highpass', f='200')
                .output(output_path)
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            return output_path
        except ffmpeg.Error as e:
            raise RuntimeError(f"ffmpeg cleanup error: {e.stderr.decode('utf8')}")
