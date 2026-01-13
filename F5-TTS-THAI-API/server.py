"""
F5-TTS Thai API Server (WebSocket + Zero-Overhead Edition)
==========================================================

Fastest possible TTS with multiple communication options:
1. WebSocket: Persistent connection, binary streaming, ~50-100ms less overhead
2. REST API: Standard HTTP, more compatible

WebSocket Benefits over REST:
- No HTTP overhead per request (~50-100ms saved)
- Persistent connection (no reconnection)
- Binary audio streaming (no base64 encoding)
- Bidirectional (can update reference mid-session)

Usage:
    python server.py
    
    WebSocket: ws://localhost:8000/ws/tts
    REST:      POST http://localhost:8000/tts
"""

import os
import sys
import time
import asyncio
import json
import base64

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import torch
import random
import tempfile
import torchaudio
import soundfile as sf
from cached_path import cached_path
import uuid
import shutil
from pathlib import Path
import numpy as np
import io

from f5_tts.infer.utils_infer import (
    load_model,
    load_vocoder,
    preprocess_ref_audio_text,
    remove_silence_for_generated_wav,
    target_sample_rate,
    hop_length,
    infer_batch_process,
    chunk_text,
)
from f5_tts.model import DiT
from f5_tts.model.utils import seed_everything
from f5_tts.cleantext.number_tha import replace_numbers_with_thai
from f5_tts.cleantext.th_repeat import process_thai_repeat

# Configuration
default_model_base = "hf://VIZINTZOR/F5-TTS-THAI/model_1000000.pt"
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
vocab_base = os.path.join(ROOT_DIR, "vocab", "vocab.txt")
vocab_ipa_base = os.path.join(ROOT_DIR, "vocab", "vocab_ipa.txt")

# Global state
f5tts_model = None
vocoder = None
device = None


class ReferenceCache:
    """Cached reference audio ready for inference (GPU tensor)"""
    def __init__(self):
        self.audio_tensor = None
        self.ref_text = None
        self.audio_path = None
        self.is_ready = False

cache = ReferenceCache()
text_cache = {}


app = FastAPI(
    title="F5-TTS Thai API (WebSocket + REST)",
    description="""
## Communication Options

### 1. WebSocket (Fastest) - `/ws/tts`
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/tts');

// Set reference once
ws.send(JSON.stringify({
    type: 'set_reference',
    audio: base64AudioData,
    ref_text: 'ข้อความอ้างอิง'
}));

// Generate (fast, no upload overhead)
ws.send(JSON.stringify({
    type: 'generate',
    text: 'ข้อความที่ต้องการสร้าง'
}));

// Receive binary audio chunks
ws.onmessage = (e) => {
    if (e.data instanceof Blob) {
        // Audio chunk
    } else {
        // JSON status message
    }
};
```

### 2. REST API - `/tts`
Standard HTTP POST with multipart form data.

## Speed Comparison
| Method | Overhead | Total (16 steps) |
|--------|----------|------------------|
| WebSocket (cached) | **~10ms** | **~300-500ms** |
| REST (cached) | ~50-100ms | ~400-600ms |
| REST (uncached) | ~200-500ms | ~800-1500ms |
    """,
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TTSResponse(BaseModel):
    success: bool
    audio_file: Optional[str] = None
    ref_text: Optional[str] = None
    seed: Optional[int] = None
    inference_time_ms: Optional[float] = None
    total_time_ms: Optional[float] = None
    message: Optional[str] = None


def load_f5tts(ckpt_path, vocab_path=vocab_base, model_type="v1"):
    if model_type == "v1":
        F5TTS_model_cfg = dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, text_mask_padding=False, conv_layers=4, pe_attn_head=1)
    elif model_type == "v2":
        F5TTS_model_cfg = dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, text_mask_padding=True, conv_layers=4, pe_attn_head=None)
        vocab_path = vocab_ipa_base
    
    try:
        import inspect
        sig = inspect.signature(DiT.__init__)
        allowed = {name for name, p in sig.parameters.items() if name != 'self'}
        filtered_cfg = {k: v for k, v in F5TTS_model_cfg.items() if k in allowed}
    except:
        filtered_cfg = F5TTS_model_cfg

    return load_model(DiT, filtered_cfg, ckpt_path, vocab_file=vocab_path, use_ema=True)


def prepare_audio_tensor(audio_path: str) -> torch.Tensor:
    """Load and prepare audio tensor on GPU"""
    audio, sr = torchaudio.load(audio_path)
    if audio.shape[0] > 1:
        audio = torch.mean(audio, dim=0, keepdim=True)
    if sr != target_sample_rate:
        audio = torchaudio.transforms.Resample(sr, target_sample_rate)(audio)
    
    rms = torch.sqrt(torch.mean(torch.square(audio)))
    if rms < 0.1:
        audio = audio * 0.1 / rms
    
    return audio.to(device)


def prepare_audio_from_bytes(audio_bytes: bytes) -> torch.Tensor:
    """Prepare audio tensor directly from bytes (WebSocket)"""
    # Save to temp buffer and load
    buffer = io.BytesIO(audio_bytes)
    audio, sr = torchaudio.load(buffer)
    
    if audio.shape[0] > 1:
        audio = torch.mean(audio, dim=0, keepdim=True)
    if sr != target_sample_rate:
        audio = torchaudio.transforms.Resample(sr, target_sample_rate)(audio)
    
    rms = torch.sqrt(torch.mean(torch.square(audio)))
    if rms < 0.1:
        audio = audio * 0.1 / rms
    
    return audio.to(device)


async def save_upload_file(upload_file: UploadFile) -> str:
    temp_dir = Path("./temp_uploads")
    temp_dir.mkdir(exist_ok=True)
    temp_path = temp_dir / f"{uuid.uuid4()}{Path(upload_file.filename).suffix}"
    with open(temp_path, "wb") as f:
        shutil.copyfileobj(upload_file.file, f)
    return str(temp_path)


def generate_audio(gen_text: str, audio_tensor: torch.Tensor, ref_text: str, 
                   nfe_step: int = 16, cfg_strength: float = 2.0, 
                   sway_sampling_coef: float = -1.0, speed: float = 1.0,
                   max_chars: int = 250, cross_fade_duration: float = 0.15):
    """Core inference function - returns numpy audio array"""
    
    # Clean text
    if gen_text not in text_cache:
        text_cache[gen_text] = process_thai_repeat(replace_numbers_with_thai(gen_text))
    gen_text_cleaned = text_cache[gen_text]
    
    # Chunk text
    gen_text_batches = chunk_text(gen_text_cleaned, max_chars=max_chars)
    
    # Inference
    with torch.inference_mode():
        result = next(infer_batch_process(
            ref_audio=(audio_tensor, target_sample_rate),
            ref_text=ref_text,
            gen_text_batches=gen_text_batches,
            model_obj=f5tts_model,
            vocoder=vocoder,
            mel_spec_type="vocos",
            progress=None,
            target_rms=0.1,
            cross_fade_duration=cross_fade_duration,
            nfe_step=nfe_step,
            cfg_strength=cfg_strength,
            sway_sampling_coef=sway_sampling_coef,
            speed=speed,
            device=device,
        ))
    
    final_wave, sample_rate, spectrogram = result
    return final_wave, sample_rate


@app.on_event("startup")
async def startup():
    global f5tts_model, vocoder, device
    
    print("=" * 60)
    print("F5-TTS Thai API (WebSocket + REST)")
    print("=" * 60)
    
    try:
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Device: {device}")
        
        if torch.cuda.is_available():
            print(f"GPU: {torch.cuda.get_device_name()}")
            torch.backends.cudnn.benchmark = True
            if hasattr(torch.backends.cuda, 'matmul'):
                torch.backends.cuda.matmul.allow_tf32 = True
                torch.backends.cudnn.allow_tf32 = True
            if hasattr(torch, 'set_float32_matmul_precision'):
                torch.set_float32_matmul_precision('high')
            print("✓ GPU optimizations enabled")
        
        print("\nLoading models...")
        vocoder = load_vocoder()
        if hasattr(vocoder, 'to'):
            vocoder = vocoder.to(device)
        
        f5tts_model = load_f5tts(str(cached_path(default_model_base)))
        f5tts_model = f5tts_model.to(device)
        f5tts_model.eval()
        
        if hasattr(torch, 'compile'):
            try:
                f5tts_model = torch.compile(f5tts_model, mode='max-autotune', dynamic=True)
                print("✓ torch.compile applied")
            except Exception as e:
                print(f"⚠ torch.compile failed: {e}")
        
        # Warmup
        print("\nWarmup...")
        with torch.inference_mode():
            try:
                dummy = torch.randn(1, 24000, device=device)
                f5tts_model.sample(
                    cond=dummy, text=["test"], duration=100, steps=2,
                    cfg_strength=0, lens=torch.tensor([100], device=device)
                )
            except:
                pass
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        print("\n" + "=" * 60)
        print("✓ Ready!")
        print("  REST:      POST http://localhost:8000/tts")
        print("  WebSocket: ws://localhost:8000/ws/tts")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


# ============================================
# WebSocket Endpoint (Fastest)
# ============================================

class WebSocketSession:
    """Per-connection session with its own cache"""
    def __init__(self):
        self.audio_tensor = None
        self.ref_text = None
        self.is_ready = False


@app.websocket("/ws/tts")
async def websocket_tts(websocket: WebSocket):
    """
    WebSocket TTS endpoint - fastest option!
    
    Messages:
    1. set_reference: {"type": "set_reference", "audio": base64, "ref_text": "..."}
    2. generate: {"type": "generate", "text": "...", "nfe_step": 16, ...}
    3. use_global_cache: {"type": "use_global_cache"} - use REST cache
    
    Responses:
    - JSON: {"type": "status", "message": "..."} or {"type": "error", ...}
    - Binary: Raw PCM audio data (float32)
    """
    await websocket.accept()
    session = WebSocketSession()
    
    try:
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket TTS ready. Send 'set_reference' or 'use_global_cache' first."
        })
        
        while True:
            # Receive message
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type", "")
            
            start_time = time.perf_counter()
            
            if msg_type == "set_reference":
                # Decode base64 audio
                try:
                    audio_bytes = base64.b64decode(msg["audio"])
                    ref_text = msg.get("ref_text", "")
                    
                    # Save temp file for preprocessing
                    temp_path = f"./temp_uploads/ws_{uuid.uuid4()}.wav"
                    os.makedirs("./temp_uploads", exist_ok=True)
                    with open(temp_path, "wb") as f:
                        f.write(audio_bytes)
                    
                    # Preprocess
                    processed_path, processed_text = preprocess_ref_audio_text(temp_path, ref_text)
                    session.audio_tensor = prepare_audio_tensor(processed_path)
                    session.ref_text = processed_text
                    session.is_ready = True
                    
                    # Cleanup
                    os.unlink(temp_path)
                    
                    elapsed = (time.perf_counter() - start_time) * 1000
                    await websocket.send_json({
                        "type": "reference_set",
                        "ref_text": processed_text,
                        "time_ms": round(elapsed, 1)
                    })
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": str(e)})
            
            elif msg_type == "use_global_cache":
                # Use the cache from REST /set_reference
                if cache.is_ready:
                    session.audio_tensor = cache.audio_tensor
                    session.ref_text = cache.ref_text
                    session.is_ready = True
                    await websocket.send_json({
                        "type": "cache_loaded",
                        "ref_text": cache.ref_text
                    })
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": "No global cache. Call REST /set_reference first."
                    })
            
            elif msg_type == "generate":
                if not session.is_ready:
                    await websocket.send_json({
                        "type": "error",
                        "message": "No reference set. Send 'set_reference' or 'use_global_cache' first."
                    })
                    continue
                
                text = msg.get("text", "")
                if not text.strip():
                    await websocket.send_json({"type": "error", "message": "Empty text"})
                    continue
                
                # Parameters
                nfe_step = msg.get("nfe_step", 16)
                cfg_strength = msg.get("cfg_strength", 2.0)
                sway_sampling_coef = msg.get("sway_sampling_coef", -1.0)
                speed = msg.get("speed", 1.0)
                
                try:
                    if torch.cuda.is_available():
                        torch.cuda.synchronize()
                    
                    infer_start = time.perf_counter()
                    
                    # Generate audio
                    audio_np, sample_rate = generate_audio(
                        text, session.audio_tensor, session.ref_text,
                        nfe_step=nfe_step, cfg_strength=cfg_strength,
                        sway_sampling_coef=sway_sampling_coef, speed=speed
                    )
                    
                    if torch.cuda.is_available():
                        torch.cuda.synchronize()
                    
                    infer_time = (time.perf_counter() - infer_start) * 1000
                    total_time = (time.perf_counter() - start_time) * 1000
                    
                    # Send audio as binary (float32 PCM)
                    audio_bytes = audio_np.astype(np.float32).tobytes()
                    await websocket.send_bytes(audio_bytes)
                    
                    # Send completion status
                    await websocket.send_json({
                        "type": "audio_complete",
                        "sample_rate": sample_rate,
                        "samples": len(audio_np),
                        "inference_ms": round(infer_time, 1),
                        "total_ms": round(total_time, 1)
                    })
                    
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    await websocket.send_json({"type": "error", "message": str(e)})
            
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown type: {msg_type}. Use: set_reference, use_global_cache, generate, ping"
                })
    
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")


# ============================================
# REST Endpoints
# ============================================

@app.get("/")
async def root():
    return {
        "message": "F5-TTS Thai API",
        "endpoints": {
            "websocket": "ws://localhost:8000/ws/tts (fastest)",
            "rest_tts": "POST /tts",
            "set_reference": "POST /set_reference",
        },
        "cache_ready": cache.is_ready,
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "device": str(device),
        "model_loaded": f5tts_model is not None,
        "cache_ready": cache.is_ready,
    }


@app.post("/set_reference")
async def set_reference(
    ref_audio: UploadFile = File(...),
    ref_text: str = Form(...)
):
    """Cache reference for REST API calls"""
    global cache
    
    try:
        start = time.perf_counter()
        audio_path = await save_upload_file(ref_audio)
        processed_path, processed_text = preprocess_ref_audio_text(audio_path, ref_text)
        
        cache.audio_tensor = prepare_audio_tensor(processed_path)
        cache.ref_text = processed_text
        cache.audio_path = audio_path
        cache.is_ready = True
        
        elapsed = (time.perf_counter() - start) * 1000
        return {"success": True, "ref_text": processed_text, "time_ms": round(elapsed, 1)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.delete("/clear_cache")
async def clear_cache():
    global cache, text_cache
    if cache.audio_path and os.path.exists(cache.audio_path):
        os.unlink(cache.audio_path)
    cache = ReferenceCache()
    text_cache.clear()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return {"success": True}


@app.post("/tts", response_model=TTSResponse)
async def text_to_speech(
    ref_audio: UploadFile = File(None),
    ref_text: str = Form(None),
    gen_text: str = Form(...),
    remove_silence: bool = Form(False),
    cross_fade_duration: float = Form(0.15),
    nfe_step: int = Form(16),
    speed: float = Form(1.0),
    cfg_strength: float = Form(2.0),
    max_chars: int = Form(250),
    seed: int = Form(-1),
    sway_sampling_coef: float = Form(-1.0),
    return_file: bool = Form(False),
):
    """REST TTS endpoint"""
    global f5tts_model, vocoder, cache
    
    if f5tts_model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    start_time = time.perf_counter()
    
    try:
        # Use cache or upload
        if cache.is_ready:
            audio_tensor = cache.audio_tensor
            ref_text_processed = cache.ref_text
        else:
            if ref_audio is None or ref_text is None:
                raise HTTPException(status_code=400, detail="No cache. Provide ref_audio/ref_text or call /set_reference")
            audio_path = await save_upload_file(ref_audio)
            processed_path, ref_text_processed = preprocess_ref_audio_text(audio_path, ref_text)
            audio_tensor = prepare_audio_tensor(processed_path)
            os.unlink(audio_path)
        
        if seed == -1:
            seed = random.randint(0, 2**31 - 1)
        seed_everything(seed)
        
        if not gen_text.strip():
            raise HTTPException(status_code=400, detail="Empty text")
        
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        
        infer_start = time.perf_counter()
        
        audio_np, sample_rate = generate_audio(
            gen_text, audio_tensor, ref_text_processed,
            nfe_step=nfe_step, cfg_strength=cfg_strength,
            sway_sampling_coef=sway_sampling_coef, speed=speed,
            max_chars=max_chars, cross_fade_duration=cross_fade_duration
        )
        
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        
        infer_time = (time.perf_counter() - infer_start) * 1000
        
        # Remove silence
        if remove_silence:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                sf.write(f.name, audio_np, sample_rate)
                remove_silence_for_generated_wav(f.name)
                audio_np, _ = torchaudio.load(f.name)
                audio_np = audio_np.squeeze().cpu().numpy()
        
        # Save
        output_dir = Path("./outputs")
        output_dir.mkdir(exist_ok=True)
        output_filename = f"gen_{uuid.uuid4().hex[:8]}.wav"
        output_path = output_dir / output_filename
        sf.write(str(output_path), audio_np, target_sample_rate)
        
        total_time = (time.perf_counter() - start_time) * 1000
        
        if return_file:
            return FileResponse(path=str(output_path), media_type="audio/wav", filename=output_filename)
        
        return TTSResponse(
            success=True,
            audio_file=str(output_path),
            ref_text=ref_text_processed,
            seed=seed,
            inference_time_ms=round(infer_time, 1),
            total_time_ms=round(total_time, 1),
        )
        
    except HTTPException:
        raise
    except Exception as e:
        return TTSResponse(success=False, message=str(e))


@app.get("/download/{filename}")
async def download_file(filename: str):
    file_path = Path("./outputs") / filename
    if file_path.exists():
        return FileResponse(path=str(file_path), filename=filename)
    raise HTTPException(status_code=404, detail="Not found")


@app.delete("/cleanup")
async def cleanup():
    count = 0
    for d in [Path("./outputs"), Path("./temp_uploads")]:
        if d.exists():
            for f in d.glob("*"):
                if f.is_file():
                    f.unlink()
                    count += 1
    text_cache.clear()
    return {"deleted": count}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, workers=1)
