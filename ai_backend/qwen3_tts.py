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
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from qwen_tts import Qwen3TTSModel

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =============================================================================
# Global State
# =============================================================================

current_model = None
current_model_type = None

# Voice reference cache: ref_id → {path, filename, ref_transcript, created_at}
_voice_ref_cache: Dict[str, Dict[str, Any]] = {}

# Default model to preload at startup (set via env var, e.g. "custom", "base", "design")
DEFAULT_PRELOAD_MODEL = os.getenv("QWEN_TTS_PRELOAD_MODEL", "custom")

# Enable PyTorch optimizations
torch.backends.cudnn.benchmark = True
torch.backends.cudnn.conv.fp32_precision = 'tf32'
torch.backends.cuda.matmul.fp32_precision = 'tf32'


# =============================================================================
# Core TTS Functions (unchanged logic from original)
# =============================================================================

def load_model(model_type):
    """Load model with SDPA optimization"""
    global current_model, current_model_type

    if current_model_type == model_type:
        logger.info(f"✅ Using cached {model_type} model")
        return current_model

    if current_model is not None:
        logger.info(f"Unloading {current_model_type} model...")
        del current_model
        gc.collect()
        torch.cuda.empty_cache()

    logger.info(f"Loading {model_type} model (1.7B)...")
    start = time.time()

    try:
        if model_type == "base":
            model_name = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
        elif model_type == "custom":
            model_name = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
        elif model_type == "design":
            model_name = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
        else:
            raise ValueError(f"Unknown model type: {model_type}")

        current_model = Qwen3TTSModel.from_pretrained(
            model_name,
            torch_dtype=torch.float16,
            device_map="cuda:0",
            attn_implementation="sdpa"
        )

        current_model_type = model_type
        load_time = time.time() - start

        allocated = torch.cuda.memory_allocated(0) / 1024**3
        logger.info(f"✅ Loaded in {load_time:.1f}s | GPU: {allocated:.2f}GB")

        return current_model

    except Exception as e:
        logger.exception(f"❌ Error loading model: {str(e)}")
        return None


def _voice_clone(text, reference_audio_path, ref_transcript, use_fast_mode):
    """Generate speech by cloning a reference voice"""
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

    logger.info("⏱️ Generating audio...")
    gen_start = time.time()

    with torch.inference_mode():
        wavs, sr = model.generate_voice_clone(
            text=text,
            voice_clone_prompt=prompt_items
        )

    gen_time = time.time() - gen_start

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    sf.write(temp_file.name, wavs[0], sr)

    total_time = time.time() - total_start
    audio_duration = len(wavs[0]) / sr
    rtf = gen_time / audio_duration

    logger.info(f"✅ Done! Total: {total_time:.1f}s | Gen: {gen_time:.1f}s | Audio: {audio_duration:.1f}s | RTF: {rtf:.2f}x")

    torch.cuda.empty_cache()
    gc.collect()

    return temp_file.name, {
        "total_time": round(total_time, 2),
        "generation_time": round(gen_time, 2),
        "audio_duration": round(audio_duration, 2),
        "rtf": round(rtf, 2),
    }


def _custom_voice(text, voice_name, instruction):
    """Generate speech using preset voices"""
    total_start = time.time()
    model = load_model("custom")
    if model is None:
        raise RuntimeError("Failed to load custom voice model")

    logger.info(f"⏱️ Generating with voice: {voice_name}...")
    if instruction and instruction.strip():
        logger.info(f"   Style instruction: '{instruction}'")

    gen_start = time.time()

    with torch.inference_mode():
        if instruction and instruction.strip():
            wavs, sr = model.generate_custom_voice(
                text=text,
                speaker=voice_name,
                instruct=instruction
            )
        else:
            wavs, sr = model.generate_custom_voice(
                text=text,
                speaker=voice_name
            )

    gen_time = time.time() - gen_start

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    sf.write(temp_file.name, wavs[0], sr)

    total_time = time.time() - total_start
    audio_duration = len(wavs[0]) / sr
    rtf = gen_time / audio_duration

    logger.info(f"✅ Done! Total: {total_time:.1f}s | Gen: {gen_time:.1f}s | Audio: {audio_duration:.1f}s | RTF: {rtf:.2f}x")

    torch.cuda.empty_cache()
    gc.collect()

    return temp_file.name, {
        "total_time": round(total_time, 2),
        "generation_time": round(gen_time, 2),
        "audio_duration": round(audio_duration, 2),
        "rtf": round(rtf, 2),
    }


def _voice_design(text, voice_description):
    """Generate speech from text description"""
    total_start = time.time()
    model = load_model("design")
    if model is None:
        raise RuntimeError("Failed to load voice design model")

    logger.info("⏱️ Generating...")
    gen_start = time.time()

    with torch.inference_mode():
        wavs, sr = model.generate_voice_design(
            text=text,
            instruct=voice_description
        )

    gen_time = time.time() - gen_start

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    sf.write(temp_file.name, wavs[0], sr)

    total_time = time.time() - total_start
    audio_duration = len(wavs[0]) / sr
    rtf = gen_time / audio_duration

    logger.info(f"✅ Done! Total: {total_time:.1f}s | Gen: {gen_time:.1f}s | Audio: {audio_duration:.1f}s | RTF: {rtf:.2f}x")

    torch.cuda.empty_cache()
    gc.collect()

    return temp_file.name, {
        "total_time": round(total_time, 2),
        "generation_time": round(gen_time, 2),
        "audio_duration": round(audio_duration, 2),
        "rtf": round(rtf, 2),
    }


# =============================================================================
# FastAPI Setup
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "N/A"
    logger.info(f"Starting Qwen3-TTS Service... GPU: {gpu_name}")

    # Preload default model at startup so first request is fast
    if DEFAULT_PRELOAD_MODEL:
        logger.info(f"Preloading '{DEFAULT_PRELOAD_MODEL}' model at startup...")
        model = load_model(DEFAULT_PRELOAD_MODEL)
        if model is not None:
            logger.info(f"✅ Model '{DEFAULT_PRELOAD_MODEL}' preloaded successfully")
        else:
            logger.warning(f"⚠️ Failed to preload model '{DEFAULT_PRELOAD_MODEL}'")

    yield
    # Cleanup on shutdown
    global current_model
    if current_model is not None:
        del current_model
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
        "current_model_loaded": current_model_type,
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