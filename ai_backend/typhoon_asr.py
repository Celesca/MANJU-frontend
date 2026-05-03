import logging
import os
import tempfile
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class LocalTyphoonASR:
    model_name: str = "scb10x/typhoon-asr-realtime"
    target_sr: int = 16000
    device: str = "cpu"

    def __post_init__(self):
        self.model = None

    def initialize(self) -> None:
        if self.model is not None:
            return

        try:
            import nemo.collections.asr as nemo_asr  # type: ignore
            import torch  # type: ignore
        except Exception as exc:
            raise RuntimeError(
                "Local Typhoon ASR dependencies are missing. Install nemo_toolkit[asr], librosa, soundfile, and torch."
            ) from exc

        if self.device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"

        logger.info("Loading local Typhoon ASR model: %s on %s", self.model_name, self.device)
        self.model = nemo_asr.models.ASRModel.from_pretrained(
            model_name=self.model_name,
            map_location=self.device,
        )
        logger.info("Local Typhoon ASR model loaded")

    def _prepare_audio(self, input_path: str) -> str:
        try:
            import librosa  # type: ignore
            import soundfile as sf  # type: ignore
        except Exception as exc:
            raise RuntimeError(
                "Audio preprocessing dependencies are missing. Install librosa and soundfile."
            ) from exc

        y, sr = librosa.load(input_path, sr=None, mono=True)
        if sr != self.target_sr:
            y = librosa.resample(y, orig_sr=sr, target_sr=self.target_sr)

        peak = float(max(abs(y))) if len(y) else 0.0
        if peak > 0:
            y = y / peak

        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        tmp_path = tmp.name
        tmp.close()
        sf.write(tmp_path, y, self.target_sr)
        return tmp_path

    def _decode_token_ids(self, ids: Any) -> str:
        if self.model is None or ids is None:
            return ""

        try:
            if hasattr(ids, "tolist"):
                ids = ids.tolist()
            if isinstance(ids, tuple):
                ids = list(ids)
            if not isinstance(ids, list):
                return ""
            ids = [int(i) for i in ids]
        except Exception:
            return ""

        # NeMo ASR models commonly expose tokenizer.ids_to_text(ids).
        try:
            tokenizer = getattr(self.model, "tokenizer", None)
            if tokenizer and hasattr(tokenizer, "ids_to_text"):
                text = tokenizer.ids_to_text(ids)
                return (text or "").strip()
        except Exception:
            pass

        return ""

    def _extract_text(self, value: Any) -> str:
        if value is None:
            return ""

        if isinstance(value, str):
            return value.strip()

        if isinstance(value, dict):
            for key in ("text", "pred_text", "transcript"):
                text = self._extract_text(value.get(key))
                if text:
                    return text

        for attr in ("text", "pred_text", "transcript"):
            if hasattr(value, attr):
                text = self._extract_text(getattr(value, attr, None))
                if text:
                    return text

        if hasattr(value, "y_sequence"):
            text = self._decode_token_ids(getattr(value, "y_sequence", None))
            if text:
                return text

        if isinstance(value, (list, tuple)):
            for item in value:
                text = self._extract_text(item)
                if text:
                    return text

        return ""

    def transcribe_file(self, input_path: str) -> str:
        if self.model is None:
            self.initialize()

        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Audio file not found: {input_path}")

        processed_path: Optional[str] = None
        try:
            processed_path = self._prepare_audio(input_path)
            try:
                result = self.model.transcribe(audio=[processed_path], batch_size=1, return_hypotheses=False)
            except TypeError:
                result = self.model.transcribe(audio=[processed_path], batch_size=1)
            except Exception:
                result = self.model.transcribe(audio=[processed_path])

            if not result:
                return ""

            first = result[0]
            logger.info("Typhoon ASR raw output type: %s", type(first).__name__)
            text = self._extract_text(result)
            if text:
                return text

            # Fallback: ask NeMo for hypotheses output and extract text.
            try:
                hyps = self.model.transcribe(audio=[processed_path], batch_size=1, return_hypotheses=True)
                text = self._extract_text(hyps)
                if text:
                    return text
            except Exception:
                pass

            logger.warning("Typhoon ASR produced output but no decodable text was found")
            return ""
        finally:
            if processed_path and os.path.exists(processed_path):
                try:
                    os.unlink(processed_path)
                except OSError:
                    pass