import os
import logging
import gc
import time
import tempfile
import shutil
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any
from datetime import datetime

import torch
import soundfile as sf
from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from qwen_tts import Qwen3TTSModel

import re
import struct
import asyncio
import numpy as np

# Thai text support (optional — install pythainlp for Thai sentence splitting)
try:
    from pythainlp.tokenize import sent_tokenize as _thai_sent_tokenize
    from pythainlp.util import isthai as _isthai
    _HAS_PYTHAINLP = True
except ImportError:
    _HAS_PYTHAINLP = False

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# Global State
# =============================================================================

# Multi-model cache: keep loaded models in GPU memory to avoid reload latency.
# H100 (80GB) can hold all three 1.7B models (~3.4 GB each) simultaneously.
_model_cache: Dict[str, Any] = {}

# Voice reference cache: ref_id → {path, filename, ref_transcript, created_at}
_voice_ref_cache: Dict[str, Dict[str, Any]] = {}

# Default model to preload at startup (set via env var, e.g. "custom", "base", "design")
DEFAULT_PRELOAD_MODEL = os.getenv("QWEN_TTS_PRELOAD_MODEL", "custom")

# Set to "true" to preload ALL 3 models at startup (H100 80GB can hold them all)
PRELOAD_ALL = os.getenv("QWEN_TTS_PRELOAD_ALL", "false").lower() in ("true", "1", "yes")

# Enable PyTorch optimizations
torch.backends.cudnn.benchmark = True
torch.backends.cudnn.conv.fp32_precision = 'tf32'
torch.backends.cuda.matmul.fp32_precision = 'tf32'


# =============================================================================
# Core TTS Functions (unchanged logic from original)
# =============================================================================

def load_model(model_type):
    """Load model with Flash Attention 2 (H100/A100) and multi-model cache.

    Models are kept in GPU memory so switching between voice-clone (base),
    custom-voice, and voice-design no longer requires a full reload.
    """
    global _model_cache

    if model_type in _model_cache:
        logger.info(f"✅ Using cached {model_type} model")
        return _model_cache[model_type]

    model_names = {
        "base": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        "custom": "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
        "design": "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    }
    if model_type not in model_names:
        raise ValueError(f"Unknown model type: {model_type}")

    logger.info(f"Loading {model_type} model (1.7B)...")
    start = time.time()

    # Try Flash Attention 2 first (best on H100/A100), then fall back to SDPA
    attempts = [
        ("flash_attention_2", torch.bfloat16),
        ("sdpa", torch.float16),
    ]
    for attn_impl, dtype in attempts:
        try:
            model = Qwen3TTSModel.from_pretrained(
                model_names[model_type],
                torch_dtype=dtype,
                device_map="cuda:0",
                attn_implementation=attn_impl,
            )
            _model_cache[model_type] = model
            load_time = time.time() - start
            allocated = torch.cuda.memory_allocated(0) / 1024**3
            logger.info(
                f"✅ Loaded {model_type} ({attn_impl}, {dtype}) "
                f"in {load_time:.1f}s | GPU: {allocated:.2f}GB"
            )
            return model
        except Exception as e:
            if attn_impl == "flash_attention_2":
                logger.warning(f"Flash Attention 2 not available ({e}), trying SDPA...")
                continue
            logger.exception(f"❌ Error loading model: {str(e)}")
            return None

    return None


# =============================================================================
# Text Splitting for Sentence-Level TTS
# =============================================================================

def _is_thai_text(text: str) -> bool:
    """Check if text is predominantly Thai."""
    if not _HAS_PYTHAINLP:
        return False
    thai_chars = sum(1 for c in text if _isthai(c))
    return (thai_chars / max(len(text), 1)) > 0.3


def split_text_for_tts(text: str, max_chunk_chars: int = 200, min_chunk_chars: int = 20) -> list:
    """Split text into sentence-level chunks optimised for TTS generation.

    * For Thai text uses PyThaiNLP sentence tokeniser.
    * For other languages splits on sentence-ending punctuation.
    * Very short sentences are merged to avoid tiny audio fragments.
    """
    text = text.strip()
    if not text:
        return [text]
    if len(text) <= max_chunk_chars:
        return [text]

    # Sentence splitting
    if _is_thai_text(text):
        sentences = _thai_sent_tokenize(text)
    else:
        # Split on sentence-ending punctuation followed by whitespace or end
        sentences = re.split(r'(?<=[.!?\u3002\uff01\uff1f;\n])\s*', text)

    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        return [text]

    # Merge short sentences into larger chunks
    chunks: list[str] = []
    current = ""
    for sent in sentences:
        if current and len(current) + len(sent) + 1 > max_chunk_chars:
            chunks.append(current)
            current = sent
        else:
            current = (current + " " + sent).strip() if current else sent
    if current:
        chunks.append(current)

    return chunks if chunks else [text]


# =============================================================================
# Audio Conversion Helpers (for streaming)
# =============================================================================

def _audio_to_pcm16(audio_array) -> bytes:
    """Convert audio numpy/torch array to int16 PCM bytes."""
    if isinstance(audio_array, torch.Tensor):
        audio_array = audio_array.cpu().numpy()
    audio = np.asarray(audio_array, dtype=np.float64)
    peak = np.abs(audio).max()
    if peak > 1.0:
        audio = audio / peak
    return (audio * 32767).clip(-32768, 32767).astype(np.int16).tobytes()


def _make_wav_header(sample_rate: int, num_channels: int = 1, bits_per_sample: int = 16) -> bytes:
    """Create a WAV header with max data length (for streaming unknown-length audio)."""
    max_data = 0x7FFFFFFF - 36
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    return (
        struct.pack('<4sI4s', b'RIFF', max_data + 36, b'WAVE')
        + struct.pack('<4sIHHIIHH', b'fmt ', 16, 1, num_channels,
                      sample_rate, byte_rate, block_align, bits_per_sample)
        + struct.pack('<4sI', b'data', max_data)
    )


def _voice_clone(text, reference_audio_path, ref_transcript, use_fast_mode):
    """Generate speech by cloning a reference voice.

    Long text is automatically split into sentences and generated per-chunk
    for faster processing. Audio chunks are concatenated before returning.
    """
    total_start = time.time()
    model = load_model("base")
    if model is None:
        raise RuntimeError("Failed to load base model")

    logger.info("⏱️ Creating prompt...")
    prompt_start = time.time()

    if use_fast_mode or not ref_transcript:
        prompt_items = model.create_voice_clone_prompt(
            ref_audio=reference_audio_path,
            x_vector_only_mode=True
        )
    else:
        prompt_items = model.create_voice_clone_prompt(
            ref_audio=reference_audio_path,
            ref_text=ref_transcript,
            x_vector_only_mode=False
        )

    prompt_time = time.time() - prompt_start
    logger.info(f"   Prompt: {prompt_time:.1f}s")

    chunks = split_text_for_tts(text)
    logger.info(f"⏱️ Generating audio ({len(chunks)} chunk(s))...")
    gen_start = time.time()

    all_audio = []
    sr = None

    with torch.inference_mode():
        for i, chunk_text in enumerate(chunks):
            if len(chunks) > 1:
                logger.info(f"   Chunk {i+1}/{len(chunks)}: {chunk_text[:60]}...")
            wavs, chunk_sr = model.generate_voice_clone(
                text=chunk_text,
                voice_clone_prompt=prompt_items
            )
            all_audio.append(wavs[0])
            sr = chunk_sr

    gen_time = time.time() - gen_start

    combined = np.concatenate(all_audio) if len(all_audio) > 1 else all_audio[0]

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    sf.write(temp_file.name, combined, sr)

    total_time = time.time() - total_start
    audio_duration = len(combined) / sr
    rtf = gen_time / audio_duration

    logger.info(f"✅ Done! Total: {total_time:.1f}s | Gen: {gen_time:.1f}s | Audio: {audio_duration:.1f}s | RTF: {rtf:.2f}x")

    torch.cuda.empty_cache()
    gc.collect()

    return temp_file.name, {
        "total_time": round(total_time, 2),
        "generation_time": round(gen_time, 2),
        "audio_duration": round(audio_duration, 2),
        "rtf": round(rtf, 2),
        "chunks": len(chunks),
    }


def _custom_voice(text, voice_name, instruction):
    """Generate speech using preset voices with sentence-level chunking."""
    total_start = time.time()
    model = load_model("custom")
    if model is None:
        raise RuntimeError("Failed to load custom voice model")

    logger.info(f"⏱️ Generating with voice: {voice_name}...")
    if instruction and instruction.strip():
        logger.info(f"   Style instruction: '{instruction}'")

    chunks = split_text_for_tts(text)
    logger.info(f"   Chunks: {len(chunks)}")
    gen_start = time.time()

    all_audio = []
    sr = None

    with torch.inference_mode():
        for i, chunk_text in enumerate(chunks):
            if len(chunks) > 1:
                logger.info(f"   Chunk {i+1}/{len(chunks)}: {chunk_text[:60]}...")
            if instruction and instruction.strip():
                wavs, chunk_sr = model.generate_custom_voice(
                    text=chunk_text,
                    speaker=voice_name,
                    instruct=instruction
                )
            else:
                wavs, chunk_sr = model.generate_custom_voice(
                    text=chunk_text,
                    speaker=voice_name
                )
            all_audio.append(wavs[0])
            sr = chunk_sr

    gen_time = time.time() - gen_start

    combined = np.concatenate(all_audio) if len(all_audio) > 1 else all_audio[0]

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    sf.write(temp_file.name, combined, sr)

    total_time = time.time() - total_start
    audio_duration = len(combined) / sr
    rtf = gen_time / audio_duration

    logger.info(f"✅ Done! Total: {total_time:.1f}s | Gen: {gen_time:.1f}s | Audio: {audio_duration:.1f}s | RTF: {rtf:.2f}x")

    torch.cuda.empty_cache()
    gc.collect()

    return temp_file.name, {
        "total_time": round(total_time, 2),
        "generation_time": round(gen_time, 2),
        "audio_duration": round(audio_duration, 2),
        "rtf": round(rtf, 2),
        "chunks": len(chunks),
    }


def _voice_design(text, voice_description):
    """Generate speech from text description with sentence-level chunking."""
    total_start = time.time()
    model = load_model("design")
    if model is None:
        raise RuntimeError("Failed to load voice design model")

    chunks = split_text_for_tts(text)
    logger.info(f"⏱️ Generating ({len(chunks)} chunk(s))...")
    gen_start = time.time()

    all_audio = []
    sr = None

    with torch.inference_mode():
        for i, chunk_text in enumerate(chunks):
            if len(chunks) > 1:
                logger.info(f"   Chunk {i+1}/{len(chunks)}: {chunk_text[:60]}...")
            wavs, chunk_sr = model.generate_voice_design(
                text=chunk_text,
                instruct=voice_description
            )
            all_audio.append(wavs[0])
            sr = chunk_sr

    gen_time = time.time() - gen_start

    combined = np.concatenate(all_audio) if len(all_audio) > 1 else all_audio[0]

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    sf.write(temp_file.name, combined, sr)

    total_time = time.time() - total_start
    audio_duration = len(combined) / sr
    rtf = gen_time / audio_duration

    logger.info(f"✅ Done! Total: {total_time:.1f}s | Gen: {gen_time:.1f}s | Audio: {audio_duration:.1f}s | RTF: {rtf:.2f}x")

    torch.cuda.empty_cache()
    gc.collect()

    return temp_file.name, {
        "total_time": round(total_time, 2),
        "generation_time": round(gen_time, 2),
        "audio_duration": round(audio_duration, 2),
        "rtf": round(rtf, 2),
        "chunks": len(chunks),
    }


# =============================================================================
# FastAPI Setup
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    global _model_cache
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "N/A"
    logger.info(f"Starting Qwen3-TTS Service... GPU: {gpu_name}")

    # Preload models at startup so first request is fast
    if PRELOAD_ALL:
        logger.info("Preloading ALL models (QWEN_TTS_PRELOAD_ALL=true)...")
        for mt in ["base", "custom", "design"]:
            model = load_model(mt)
            if model is not None:
                logger.info(f"\u2705 Model '{mt}' preloaded")
            else:
                logger.warning(f"\u26a0\ufe0f Failed to preload '{mt}'")
    elif DEFAULT_PRELOAD_MODEL:
        logger.info(f"Preloading '{DEFAULT_PRELOAD_MODEL}' model at startup...")
        model = load_model(DEFAULT_PRELOAD_MODEL)
        if model is not None:
            logger.info(f"\u2705 Model '{DEFAULT_PRELOAD_MODEL}' preloaded successfully")
        else:
            logger.warning(f"\u26a0\ufe0f Failed to preload model '{DEFAULT_PRELOAD_MODEL}'")

    # CUDA warmup: run a tiny dummy TTS inference to warm up CUDA kernels,
    # cuBLAS handles, and GPU memory allocator. This eliminates the ~2-5s
    # cold-start penalty on the very first real request.
    if _model_cache and torch.cuda.is_available():
        logger.info("\u26a1 Running CUDA warmup inference...")
        warmup_start = time.time()
        try:
            warmup_model_type = next(iter(_model_cache))
            warmup_model = _model_cache[warmup_model_type]
            with torch.inference_mode():
                if warmup_model_type == "custom":
                    warmup_model.generate_custom_voice(text="Hello.", speaker="serena")
                elif warmup_model_type == "design":
                    warmup_model.generate_voice_design(text="Hello.", instruct="A calm voice.")
                # Skip warmup for "base" (needs reference audio)
            torch.cuda.empty_cache()
            logger.info(f"\u26a1 Warmup done in {time.time() - warmup_start:.1f}s")
        except Exception as e:
            logger.warning(f"Warmup failed (non-fatal): {e}")

    total_vram = torch.cuda.memory_allocated(0) / 1024**3 if torch.cuda.is_available() else 0
    logger.info(f"\u2705 Service ready. Models loaded: {list(_model_cache.keys())} | GPU VRAM: {total_vram:.2f}GB")
    yield
    # Cleanup on shutdown
    for model_type_key, model_ref in _model_cache.items():
        logger.info(f"Unloading {model_type_key} model...")
        del model_ref
    _model_cache.clear()
    gc.collect()
    torch.cuda.empty_cache()
    # Clean up cached voice reference files
    for ref_id, info in _voice_ref_cache.items():
        try:
            os.unlink(info["path"])
        except OSError:
            pass
    _voice_ref_cache.clear()
    logger.info("Qwen3-TTS Service shut down.")


async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Middleware to verify the X-API-Key header."""
    expected_key = os.getenv("MANJU_API_KEY")
    if not expected_key:
        return
    if x_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing API Key")
    return x_api_key


app = FastAPI(
    title="MANJU Qwen3-TTS Service",
    description="Qwen3-TTS voice cloning, custom voice, and voice design service",
    version="1.0.0",
    lifespan=lifespan,
    dependencies=[Depends(verify_api_key)],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Request/Response Models
# =============================================================================

class CustomVoiceRequest(BaseModel):
    """Request for custom preset voice TTS."""
    text: str
    voice_name: str = "serena"
    instruction: Optional[str] = None


class VoiceDesignRequest(BaseModel):
    """Request for voice design TTS."""
    text: str
    voice_description: str


AVAILABLE_VOICES = [
    "serena", "vivian", "ono_anna", "sohee",
    "aiden", "dylan", "eric", "ryan", "uncle_fu",
]


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check — reports GPU info and loaded model."""
    gpu_available = torch.cuda.is_available()
    return {
        "status": "healthy",
        "gpu_available": gpu_available,
        "gpu_name": torch.cuda.get_device_name(0) if gpu_available else None,
        "gpu_memory_gb": round(torch.cuda.memory_allocated(0) / 1024**3, 2) if gpu_available else None,
        "current_model_loaded": list(_model_cache.keys()),
        "available_voices": AVAILABLE_VOICES,
    }


@app.post("/qwen-tts/voice-clone")
async def voice_clone_endpoint(
    text: str = Form(...),
    reference_audio: UploadFile = File(...),
    ref_transcript: Optional[str] = Form(None),
    use_fast_mode: bool = Form(True),
):
    """
    Clone a voice from a reference audio file.

    - **text**: The text to synthesize
    - **reference_audio**: Reference audio file (3+ seconds, WAV/MP3)
    - **ref_transcript**: Optional transcript of the reference audio (improves quality)
    - **use_fast_mode**: Skip transcript processing for faster generation (default: True)
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    # Save uploaded audio to a temp file
    ref_temp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(reference_audio.filename or ".wav")[1])
    try:
        content = await reference_audio.read()
        ref_temp.write(content)
        ref_temp.close()

        output_path, metrics = _voice_clone(text, ref_temp.name, ref_transcript, use_fast_mode)

        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="voice_clone_output.wav",
            headers={
                "X-Total-Time": str(metrics["total_time"]),
                "X-Generation-Time": str(metrics["generation_time"]),
                "X-Audio-Duration": str(metrics["audio_duration"]),
                "X-RTF": str(metrics["rtf"]),
            },
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Error in voice clone")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up the uploaded reference temp file
        try:
            os.unlink(ref_temp.name)
        except OSError:
            pass


@app.post("/qwen-tts/custom-voice")
async def custom_voice_endpoint(request: CustomVoiceRequest):
    """
    Generate speech using one of 9 preset character voices.

    Available voices:
    - **Female**: serena, vivian, ono_anna, sohee
    - **Male**: aiden, dylan, eric, ryan, uncle_fu
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    if request.voice_name not in AVAILABLE_VOICES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid voice '{request.voice_name}'. Available: {AVAILABLE_VOICES}",
        )

    try:
        output_path, metrics = _custom_voice(request.text, request.voice_name, request.instruction)

        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="custom_voice_output.wav",
            headers={
                "X-Total-Time": str(metrics["total_time"]),
                "X-Generation-Time": str(metrics["generation_time"]),
                "X-Audio-Duration": str(metrics["audio_duration"]),
                "X-RTF": str(metrics["rtf"]),
            },
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Error in custom voice")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/qwen-tts/voice-design")
async def voice_design_endpoint(request: VoiceDesignRequest):
    """
    Design a unique voice from a text description.

    Description tips:
    - Age: young / middle-aged / elderly
    - Gender: male / female
    - Emotion: cheerful / serious / calm / excited
    - Style: clear / soft / authoritative / energetic

    Example: "A young female, cheerful and bubbly, speaking energetically"
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    if not request.voice_description.strip():
        raise HTTPException(status_code=400, detail="Voice description is required")

    try:
        output_path, metrics = _voice_design(request.text, request.voice_description)

        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="voice_design_output.wav",
            headers={
                "X-Total-Time": str(metrics["total_time"]),
                "X-Generation-Time": str(metrics["generation_time"]),
                "X-Audio-Duration": str(metrics["audio_duration"]),
                "X-RTF": str(metrics["rtf"]),
            },
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Error in voice design")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Voice Reference Cache Endpoints
# =============================================================================

@app.post("/voice-references/upload")
async def upload_voice_reference(
    file: UploadFile = File(...),
    ref_transcript: Optional[str] = Form(None),
):
    """
    Upload and cache a reference voice audio for voice cloning.
    Returns a reference ID that can be re-used across multiple TTS requests.
    """
    import uuid as _uuid

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".wav", ".mp3", ".m4a", ".ogg", ".flac"}:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {ext}")

    ref_id = str(_uuid.uuid4())
    cache_dir = os.path.join(tempfile.gettempdir(), "qwen_voice_refs")
    os.makedirs(cache_dir, exist_ok=True)

    dest_path = os.path.join(cache_dir, f"{ref_id}{ext}")
    content = await file.read()
    with open(dest_path, "wb") as f:
        f.write(content)

    _voice_ref_cache[ref_id] = {
        "path": dest_path,
        "filename": file.filename,
        "ref_transcript": ref_transcript,
        "created_at": datetime.now().isoformat(),
    }

    logger.info("Cached voice reference %s (%s, %d bytes)", ref_id, file.filename, len(content))

    return {
        "id": ref_id,
        "filename": file.filename,
        "ref_transcript": ref_transcript,
        "created_at": _voice_ref_cache[ref_id]["created_at"],
    }


@app.get("/voice-references")
async def list_voice_references():
    """List all cached voice references."""
    return [
        {
            "id": ref_id,
            "filename": info["filename"],
            "ref_transcript": info.get("ref_transcript"),
            "created_at": info["created_at"],
        }
        for ref_id, info in _voice_ref_cache.items()
    ]


@app.get("/voice-references/{ref_id}")
async def get_voice_reference(ref_id: str):
    """Get details of a cached voice reference."""
    if ref_id not in _voice_ref_cache:
        raise HTTPException(status_code=404, detail="Voice reference not found")
    info = _voice_ref_cache[ref_id]
    return {
        "id": ref_id,
        "filename": info["filename"],
        "ref_transcript": info.get("ref_transcript"),
        "created_at": info["created_at"],
    }


@app.put("/voice-references/{ref_id}")
async def update_voice_reference(ref_id: str, ref_transcript: str = Form(...)):
    """Update the reference transcript for a cached voice."""
    if ref_id not in _voice_ref_cache:
        raise HTTPException(status_code=404, detail="Voice reference not found")
    _voice_ref_cache[ref_id]["ref_transcript"] = ref_transcript
    info = _voice_ref_cache[ref_id]
    return {
        "id": ref_id,
        "filename": info["filename"],
        "ref_transcript": ref_transcript,
        "created_at": info["created_at"],
    }


@app.delete("/voice-references/{ref_id}")
async def delete_voice_reference(ref_id: str):
    """Delete a cached voice reference."""
    if ref_id not in _voice_ref_cache:
        raise HTTPException(status_code=404, detail="Voice reference not found")
    info = _voice_ref_cache.pop(ref_id)
    try:
        os.unlink(info["path"])
    except OSError:
        pass
    return {"success": True}


@app.post("/voice-references/{ref_id}/clone")
async def clone_with_reference(
    ref_id: str,
    text: str = Form(...),
    use_fast_mode: bool = Form(True),
):
    """
    Generate speech using a cached voice reference (voice cloning shortcut).
    """
    if ref_id not in _voice_ref_cache:
        raise HTTPException(status_code=404, detail="Voice reference not found")

    info = _voice_ref_cache[ref_id]

    try:
        output_path, metrics = _voice_clone(
            text=text,
            reference_audio_path=info["path"],
            ref_transcript=info.get("ref_transcript"),
            use_fast_mode=use_fast_mode,
        )
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename="voice_clone_output.wav",
            headers={
                "X-Total-Time": str(metrics["total_time"]),
                "X-Generation-Time": str(metrics["generation_time"]),
                "X-Audio-Duration": str(metrics["audio_duration"]),
                "X-RTF": str(metrics["rtf"]),
            },
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Error in cached voice clone")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Streaming TTS Endpoints — progressive audio delivery
# =============================================================================

@app.post("/qwen-tts/stream/voice-clone")
async def stream_voice_clone(
    text: str = Form(...),
    reference_audio: UploadFile = File(...),
    ref_transcript: Optional[str] = Form(None),
    use_fast_mode: bool = Form(True),
):
    """Streaming voice clone — splits text into sentences, generates audio per
    sentence, and streams a WAV file progressively (WAV header + PCM chunks).

    The client receives audio data for the first sentence as soon as it is
    generated, before subsequent sentences are processed.
    """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    model = load_model("base")
    if model is None:
        raise HTTPException(status_code=503, detail="Failed to load base model")

    # Save uploaded reference to temp file
    ext = os.path.splitext(reference_audio.filename or ".wav")[1]
    ref_temp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    try:
        content = await reference_audio.read()
        ref_temp.write(content)
        ref_temp.close()
    except Exception:
        try:
            os.unlink(ref_temp.name)
        except OSError:
            pass
        raise

    # Pre-compute voice clone prompt once (reused across all chunks)
    if use_fast_mode or not ref_transcript:
        prompt_items = model.create_voice_clone_prompt(
            ref_audio=ref_temp.name, x_vector_only_mode=True)
    else:
        prompt_items = model.create_voice_clone_prompt(
            ref_audio=ref_temp.name, ref_text=ref_transcript, x_vector_only_mode=False)

    chunks = split_text_for_tts(text)
    logger.info(f"Stream voice-clone: {len(chunks)} chunks, {len(text)} chars total")

    def generate():
        """Sync generator: WAV header + PCM int16 data per sentence chunk."""
        try:
            header_sent = False
            for i, chunk_text in enumerate(chunks):
                logger.info(f"  Stream chunk {i+1}/{len(chunks)}: {chunk_text[:50]}...")
                start = time.time()
                with torch.inference_mode():
                    wavs, sr = model.generate_voice_clone(
                        text=chunk_text, voice_clone_prompt=prompt_items)
                gen_t = time.time() - start
                logger.info(f"  Chunk {i+1} generated in {gen_t:.1f}s")

                pcm = _audio_to_pcm16(wavs[0])
                if not header_sent:
                    yield _make_wav_header(sr)
                    header_sent = True
                yield pcm
                torch.cuda.empty_cache()
        finally:
            try:
                os.unlink(ref_temp.name)
            except OSError:
                pass
            gc.collect()
            torch.cuda.empty_cache()

    return StreamingResponse(generate(), media_type="audio/wav")


@app.post("/qwen-tts/stream/custom-voice")
async def stream_custom_voice(request: CustomVoiceRequest):
    """Streaming custom voice — sentence-level generation with progressive WAV."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    if request.voice_name not in AVAILABLE_VOICES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid voice '{request.voice_name}'. Available: {AVAILABLE_VOICES}",
        )

    model = load_model("custom")
    if model is None:
        raise HTTPException(status_code=503, detail="Failed to load model")

    chunks = split_text_for_tts(request.text)
    voice_name = request.voice_name
    instruction = request.instruction
    logger.info(f"Stream custom-voice ({voice_name}): {len(chunks)} chunks")

    def generate():
        header_sent = False
        for i, chunk_text in enumerate(chunks):
            logger.info(f"  Stream chunk {i+1}/{len(chunks)}: {chunk_text[:50]}...")
            start = time.time()
            with torch.inference_mode():
                if instruction and instruction.strip():
                    wavs, sr = model.generate_custom_voice(
                        text=chunk_text, speaker=voice_name, instruct=instruction)
                else:
                    wavs, sr = model.generate_custom_voice(
                        text=chunk_text, speaker=voice_name)
            gen_t = time.time() - start
            logger.info(f"  Chunk {i+1} generated in {gen_t:.1f}s")

            pcm = _audio_to_pcm16(wavs[0])
            if not header_sent:
                yield _make_wav_header(sr)
                header_sent = True
            yield pcm
            torch.cuda.empty_cache()
        gc.collect()

    return StreamingResponse(generate(), media_type="audio/wav")


@app.post("/qwen-tts/stream/voice-design")
async def stream_voice_design(request: VoiceDesignRequest):
    """Streaming voice design — sentence-level generation with progressive WAV."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    if not request.voice_description.strip():
        raise HTTPException(status_code=400, detail="Voice description is required")

    model = load_model("design")
    if model is None:
        raise HTTPException(status_code=503, detail="Failed to load model")

    chunks = split_text_for_tts(request.text)
    voice_description = request.voice_description
    logger.info(f"Stream voice-design: {len(chunks)} chunks")

    def generate():
        header_sent = False
        for i, chunk_text in enumerate(chunks):
            logger.info(f"  Stream chunk {i+1}/{len(chunks)}: {chunk_text[:50]}...")
            start = time.time()
            with torch.inference_mode():
                wavs, sr = model.generate_voice_design(
                    text=chunk_text, instruct=voice_description)
            gen_t = time.time() - start
            logger.info(f"  Chunk {i+1} generated in {gen_t:.1f}s")

            pcm = _audio_to_pcm16(wavs[0])
            if not header_sent:
                yield _make_wav_header(sr)
                header_sent = True
            yield pcm
            torch.cuda.empty_cache()
        gc.collect()

    return StreamingResponse(generate(), media_type="audio/wav")


# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("QWEN_TTS_PORT", "8001"))
    logger.info(f"Starting Qwen3-TTS FastAPI on port {port}...")
    uvicorn.run(
        "qwen3_tts:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )