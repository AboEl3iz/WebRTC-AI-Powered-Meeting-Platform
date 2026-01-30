import os
import ffmpeg

class AudioExtractor:
    @staticmethod
    def extract(input_path: str, output_path: str = None) -> str:
        """
        Extracts audio from a video file using ffmpeg.
        Returns the path to the extracted audio file.
        """
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
        
        if output_path is None:
            base, _ = os.path.splitext(input_path)
            output_path = f"{base}.wav"

        try:
            (
                ffmpeg
                .input(input_path)
                .output(output_path, acodec='pcm_s16le', ac=1, ar='16k')
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            return output_path
        except ffmpeg.Error as e:
            raise RuntimeError(f"ffmpeg error: {e.stderr.decode('utf8')}")
