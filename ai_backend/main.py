"""
Workflow Executor Service using LangGraph
Executes workflow configurations from the frontend and returns AI responses.
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from datetime import datetime

import hashlib
import re
import httpx
import tempfile
import shutil
from urllib.parse import quote as url_quote

from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from openai import OpenAI

from workflow_executor import WorkflowExecutor, DocumentEmbeddingService
from typhoon_asr import LocalTyphoonASR

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global instances
executor: Optional[WorkflowExecutor] = None
embedding_service: Optional[DocumentEmbeddingService] = None
openai_client: Optional[OpenAI] = None
http_client: Optional[httpx.AsyncClient] = None
local_typhoon_asr: Optional[LocalTyphoonASR] = None

# Qwen TTS service URL
QWEN_TTS_URL = os.getenv("QWEN_TTS_URL", "http://localhost:8001")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    global executor, embedding_service, openai_client, http_client, local_typhoon_asr
    logger.info("Starting AI Workflow Service...")
    executor = WorkflowExecutor()
    embedding_service = DocumentEmbeddingService()
    http_client = httpx.AsyncClient(timeout=httpx.Timeout(120.0))
    
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        openai_client = OpenAI(api_key=api_key)
    else:
        logger.info("OPENAI_API_KEY not found in environment. Users will need to provide their own keys for TTS.")

    # Pre-warm Qwen TTS model at startup (fire-and-forget health check)
    try:
        resp = await http_client.get(f"{QWEN_TTS_URL}/health")
        if resp.status_code == 200:
            logger.info("Qwen3-TTS service is reachable at %s", QWEN_TTS_URL)
        else:
            logger.warning("Qwen3-TTS service returned status %s", resp.status_code)
    except Exception:
        logger.warning("Qwen3-TTS service not reachable at %s — /talk endpoints will fail", QWEN_TTS_URL)

    # Initialize local Typhoon ASR model at startup to avoid first-request cold start.
    use_local_asr = os.getenv("USE_LOCAL_TYPHOON_ASR", "true").lower() in ("1", "true", "yes")
    if use_local_asr:
        try:
            local_typhoon_asr = LocalTyphoonASR(device=os.getenv("TYPHOON_ASR_DEVICE", "cpu"))
            local_typhoon_asr.initialize()
        except Exception:
            local_typhoon_asr = None
            logger.exception("Failed to initialize local Typhoon ASR model")
    else:
        logger.info("USE_LOCAL_TYPHOON_ASR disabled; /asr/transcribe will return empty text")
        
    yield
    logger.info("Shutting down AI Workflow Service...")
    if http_client:
        await http_client.aclose()


async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Middleware to verify the X-API-Key header."""
    expected_key = os.getenv("MANJU_API_KEY")
    if not expected_key:
        return # If not set, allow all (safety for initial setup)
    
    if x_api_key != expected_key:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing API Key")
    return x_api_key


app = FastAPI(
    title="MANJU AI Workflow Service",
    description="LangGraph-based workflow execution service for voice chatbot workflows",
    version="1.0.0",
    lifespan=lifespan,
    dependencies=[Depends(verify_api_key)],
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Request/Response Models
# =============================================================================

class NodePort(BaseModel):
    id: str
    label: str
    position: Optional[str] = None


class WorkflowNode(BaseModel):
    id: str
    type: str
    position: Dict[str, float]
    data: Dict[str, Any] = Field(default_factory=dict)
    inputs: List[NodePort] = Field(default_factory=list)
    outputs: List[NodePort] = Field(default_factory=list)


class Connection(BaseModel):
    id: str
    sourceNodeId: str
    sourcePortId: str
    targetNodeId: str
    targetPortId: str


class WorkflowConfig(BaseModel):
    """Workflow configuration from frontend."""
    nodes: List[WorkflowNode]
    connections: List[Connection]


class ChatRequest(BaseModel):
    """Request for chat interaction."""
    message: str
    workflow: WorkflowConfig
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    session_id: Optional[str] = None
    openai_api_key: Optional[str] = None  # User-provided API key


class ChatResponse(BaseModel):
    """Response from chat interaction."""
    response: str
    model_used: Optional[str] = None
    processing_time_ms: float
    nodes_executed: List[str] = Field(default_factory=list)

    t_ret_ms: Optional[float] = None
    t_llm_ms: Optional[float] = None
    t_ttft_ms: Optional[float] = None
    t_tts_ms: Optional[float] = None
    t_e2e_ms: Optional[float] = None


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    models_available: List[str]


class WorkflowTypeResponse(BaseModel):
    """Response for workflow type detection."""
    input_type: str  # "text" or "voice"
    output_type: str  # "text" or "voice"
    workflow_type: str  # "text-to-text", "text-to-voice", "voice-to-text", "voice-to-voice"
    has_rag: bool
    has_sheets: bool
    has_condition: bool
    tts_provider: str = "openai"  # "openai" or "qwen3"
    asr_provider: str = "web-speech"  # "web-speech" or "typhoon"


class TTSRequest(BaseModel):
    """Request for Text-to-Speech."""
    text: str
    voice: str = "alloy"
    model: str = "tts-1"
    openai_api_key: Optional[str] = None  # User-provided API key


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    models = []
    if os.getenv("OPENAI_API_KEY"):
        models.append("openai")
    if os.getenv("TOGETHER_API_KEY"):
        models.append("together")
    if os.getenv("OPENROUTER_API_KEY"):
        models.append("openrouter")
    
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        models_available=models if models else ["none - configure API keys"],
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Execute a chat interaction using the provided workflow configuration.
    
    The workflow is converted to a LangGraph and executed with the user's message.
    """
    if executor is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        start_time = datetime.now()
        
        # Execute the workflow
        result = await executor.execute(
            message=request.message,
            workflow=request.workflow,
            conversation_history=request.conversation_history,
            session_id=request.session_id,
            openai_api_key=request.openai_api_key,
        )
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return ChatResponse(
            response=result.get("response", "No response generated"),
            model_used=result.get("model_used"),
            processing_time_ms=processing_time,
            nodes_executed=result.get("nodes_executed", []),

            t_ret_ms=result.get("t_ret_ms"),
            t_llm_ms=result.get("t_llm_ms"),
            t_ttft_ms=result.get("t_ttft_ms"),
            t_tts_ms=result.get("t_tts_ms"),
            t_e2e_ms=result.get("t_e2e_ms"),
        )
    
    except Exception as e:
        logger.exception("Error executing workflow")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/validate")
async def validate_workflow(workflow: WorkflowConfig):
    """
    Validate a workflow configuration without executing it.
    Returns information about the workflow structure.
    """
    if executor is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        validation = executor.validate_workflow(workflow)
        return validation
    except Exception as e:
        logger.exception("Error validating workflow")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/workflow-type", response_model=WorkflowTypeResponse)
async def get_workflow_type(workflow: WorkflowConfig):
    """
    Detect the workflow input/output modalities.
    
    Returns whether the workflow expects text or voice input,
    and whether it produces text or voice output.
    """
    if executor is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        workflow_type = executor.get_workflow_type(workflow)
        return WorkflowTypeResponse(**workflow_type)
    except Exception as e:
        logger.exception("Error detecting workflow type")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech using OpenAI TTS.
    Returns an MP3 audio stream.
    """
    # Use request-provided key or server-wide key if available
    api_key = request.openai_api_key or os.getenv("OPENAI_API_KEY")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key is required. Configure it in Settings.")

    try:
        # Create a temporary client if using a request-specific key
        # or use the global client if it exists and matches
        client = openai_client
        if request.openai_api_key or not client:
            client = OpenAI(api_key=api_key)

        response = client.audio.speech.create(
            model=request.model,
            voice=request.voice,
            input=request.text,
        )
        
        return StreamingResponse(response.iter_bytes(), media_type="audio/mpeg")
        
    except Exception as e:
        logger.exception("Error in TTS generation")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# ASR — Typhoon ASR via OpenAI-compatible API
# =============================================================================

@app.post("/asr/transcribe")
async def asr_transcribe(file: UploadFile = File(...)):
    """
    Transcribe an audio file using Typhoon ASR API.
    Requires TYPHOON_API_KEY in the environment.
    Returns empty text if Typhoon API fails (will trigger Web Speech fallback on frontend).
    """
    if not local_typhoon_asr:
        logger.warning("Local Typhoon ASR model is not initialized, returning empty transcription")
        return {"text": ""}

    try:
        # Save uploaded file to a temp path (OpenAI client needs a file-like object)
        suffix = "." + (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "wav")
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        try:
            content = await file.read()
            tmp.write(content)
            tmp.flush()
            tmp.close()

            result_text = local_typhoon_asr.transcribe_file(tmp.name)
            logger.info(f"Typhoon ASR result: {result_text[:100]}")
            return {"text": result_text}
        finally:
            # Clean up temp file
            try:
                os.unlink(tmp.name)
            except OSError:
                pass

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Typhoon ASR transcription failed")
        # Return empty text instead of error to trigger Web Speech fallback on frontend
        return {"text": ""}


# =============================================================================
# Text splitting for sentence-level TTS pipeline
# =============================================================================

# Try to import PyThaiNLP for Thai sentence splitting
try:
    from pythainlp.tokenize import sent_tokenize as _thai_sent_tokenize
    from pythainlp.util import isthai as _isthai
    _HAS_PYTHAINLP = True
except ImportError:
    _HAS_PYTHAINLP = False

def _contains_thai(text: str) -> bool:
    """Check if text contains Thai characters."""
    if _HAS_PYTHAINLP:
        return any(_isthai(ch) for ch in text if ch.strip())
    return any('\u0e00' <= ch <= '\u0e7f' for ch in text)

def split_text_for_tts(text: str, max_chars: int = 200) -> List[str]:
    """Split text into sentence chunks for TTS pipeline.

    Uses PyThaiNLP for Thai text, regex for others.
    Merges short sentences into chunks of roughly *max_chars*.
    """
    text = text.strip()
    if not text:
        return []

    # --- sentence-level split ---
    if _contains_thai(text) and _HAS_PYTHAINLP:
        raw_sentences = _thai_sent_tokenize(text)
    else:
        raw_sentences = re.split(r'(?<=[.!?\u0e2f\u0e46])\s*', text)

    raw_sentences = [s.strip() for s in raw_sentences if s.strip()]

    if not raw_sentences:
        return [text]

    # --- merge short sentences into ~max_chars chunks ---
    chunks: List[str] = []
    current = ""
    for sent in raw_sentences:
        if current and len(current) + len(sent) + 1 > max_chars:
            chunks.append(current)
            current = sent
        else:
            current = f"{current} {sent}".strip() if current else sent
    if current:
        chunks.append(current)

    return chunks if chunks else [text]

def _make_cache_key(text: str, tts_mode: str, voice_name: str,
                    instruction: Optional[str] = None,
                    voice_description: Optional[str] = None) -> str:
    """Generate a deterministic cache key for a TTS request."""
    raw = f"{text}|{tts_mode}|{voice_name}|{instruction or ''}|{voice_description or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()[:24]


# =============================================================================
# Talk Endpoints — Workflow chat → Qwen3 TTS voice output
# =============================================================================

class TalkRequest(BaseModel):
    """Request for /talk — runs workflow then synthesises voice via Qwen3-TTS or OpenAI TTS."""
    message: str
    workflow: WorkflowConfig
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)
    session_id: Optional[str] = None
    openai_api_key: Optional[str] = None
    # TTS provider selection
    tts_provider: str = "qwen3"  # "openai" | "qwen3"
    # OpenAI TTS settings (used when tts_provider="openai")
    openai_voice: str = "alloy"
    openai_model: str = "tts-1"
    # Qwen TTS settings (used when tts_provider="qwen3")
    tts_mode: str = "custom"  # "custom" | "voice-clone" | "voice-design"
    voice_name: str = "serena"  # For custom voice mode
    instruction: Optional[str] = None  # Style instruction for custom voice
    voice_description: Optional[str] = None  # For voice-design mode
    reference_voice_id: Optional[str] = None  # Cached ref voice ID for clone mode
    use_fast_mode: bool = True


class TalkResponse(BaseModel):
    """Response from /talk (JSON metadata — audio is streamed separately)."""
    text_response: str
    model_used: Optional[str] = None
    processing_time_ms: float
    nodes_executed: List[str] = Field(default_factory=list)
    audio_url: Optional[str] = None  # Relative URL to fetch audio separately

    t_ret_ms: Optional[float] = None
    t_llm_ms: Optional[float] = None
    t_ttft_ms: Optional[float] = None
    t_tts_ms: Optional[float] = None
    t_e2e_ms: Optional[float] = None


class VoiceReferenceCache(BaseModel):
    """Cached voice reference info."""
    id: str
    filename: str
    ref_transcript: Optional[str] = None
    created_at: str


# In-memory voice reference cache (maps ref_id → local temp path + transcript)
_voice_ref_cache: Dict[str, Dict[str, Any]] = {}


@app.post("/talk")
async def talk(request: TalkRequest):
    """
    Workflow chat → JSON response with text + sentence chunks.

    Returns the AI text, pre-split sentences for the client-side TTS pipeline,
    and a cache key for audio caching.  The client then calls /tts-sentence
    for each chunk individually, enabling play-while-generating.
    """
    if executor is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    if http_client is None:
        raise HTTPException(status_code=503, detail="HTTP client not initialized")

    start_time = datetime.now()

    # Step 1 — Run workflow
    try:
        result = await executor.execute(
            message=request.message,
            workflow=request.workflow,
            conversation_history=request.conversation_history,
            session_id=request.session_id,
            openai_api_key=request.openai_api_key,
        )
    except Exception as e:
        logger.exception("Error executing workflow in /talk")
        raise HTTPException(status_code=500, detail=f"Workflow error: {e}")

    text_response = result.get("response", "")
    if not text_response:
        raise HTTPException(status_code=500, detail="Workflow produced no text response")

    processing_time = (datetime.now() - start_time).total_seconds() * 1000

    # Step 2 — Split text into sentence chunks for client-side TTS pipeline
    sentences = split_text_for_tts(text_response, max_chars=200)

    # Step 3 — Generate cache key (provider-aware so OpenAI and Qwen don't collide)
    if request.tts_provider == "openai":
        cache_key = _make_cache_key(
            text_response, f"openai_{request.openai_model}", request.openai_voice,
        )
    else:
        cache_key = _make_cache_key(
            text_response, request.tts_mode, request.voice_name,
            request.instruction, request.voice_description,
        )

    return {
        "text_response": text_response,
        "sentences": sentences,
        "cache_key": cache_key,
        "model_used": result.get("model_used") or "",
        "processing_time_ms": round(processing_time, 2),
        "nodes_executed": result.get("nodes_executed", []),

        "t_ret_ms": result.get("t_ret_ms"),
        "t_llm_ms": result.get("t_llm_ms"),
        "t_ttft_ms": result.get("t_ttft_ms"),
        "t_tts_ms": result.get("t_tts_ms"),
        "t_e2e_ms": result.get("t_e2e_ms"),
        # tts_provider tells the frontend which pipeline to use for audio synthesis
        "tts_provider": request.tts_provider,
        "tts_settings": {
            "tts_mode": request.tts_mode,
            "voice_name": request.voice_name,
            "instruction": request.instruction,
            "voice_description": request.voice_description,
            "reference_voice_id": request.reference_voice_id,
            "use_fast_mode": request.use_fast_mode,
        },
        # OpenAI TTS params forwarded to Go /tts endpoint if tts_provider=openai
        "openai_tts": {
            "voice": request.openai_voice,
            "model": request.openai_model,
        },
    }


class TTSSentenceRequest(BaseModel):
    """Request for /tts-sentence — synthesise a single sentence chunk."""
    text: str
    tts_mode: str = "custom"
    voice_name: str = "serena"
    instruction: Optional[str] = None
    voice_description: Optional[str] = None
    reference_voice_id: Optional[str] = None
    use_fast_mode: bool = True


@app.post("/tts-sentence")
async def tts_sentence(request: TTSSentenceRequest):
    """
    Synthesise a single sentence chunk via Qwen3-TTS.

    Returns a complete WAV file (not streamed). Designed to be called
    once per sentence from the client-side pipeline so that sentence 1
    plays while sentence 2 is being synthesised.
    """
    if http_client is None:
        raise HTTPException(status_code=503, detail="HTTP client not initialized")

    try:
        audio_bytes = await _qwen_tts_synthesize(
            text=request.text,
            mode=request.tts_mode,
            voice_name=request.voice_name,
            instruction=request.instruction,
            voice_description=request.voice_description,
            reference_voice_id=request.reference_voice_id,
            use_fast_mode=request.use_fast_mode,
        )
    except Exception as e:
        logger.exception("Error in /tts-sentence")
        raise HTTPException(status_code=502, detail=str(e))

    return StreamingResponse(iter([audio_bytes]), media_type="audio/wav")


@app.post("/talk/text-to-voice")
async def talk_text_to_voice(
    text: str = Form(...),
    tts_mode: str = Form("custom"),
    voice_name: str = Form("serena"),
    instruction: Optional[str] = Form(None),
    voice_description: Optional[str] = Form(None),
    reference_voice_id: Optional[str] = Form(None),
    use_fast_mode: bool = Form(True),
):
    """
    Simple text → Qwen3-TTS voice endpoint (no workflow execution).
    Useful for replaying or converting arbitrary text to voice.
    """
    if http_client is None:
        raise HTTPException(status_code=503, detail="HTTP client not initialized")

    try:
        audio_bytes = await _qwen_tts_synthesize(
            text=text,
            mode=tts_mode,
            voice_name=voice_name,
            instruction=instruction,
            voice_description=voice_description,
            reference_voice_id=reference_voice_id,
            use_fast_mode=use_fast_mode,
        )
    except Exception as e:
        logger.exception("Error in text-to-voice")
        raise HTTPException(status_code=502, detail=str(e))

    return StreamingResponse(iter([audio_bytes]), media_type="audio/wav")


# =============================================================================
# Voice Reference Cache Endpoints
# =============================================================================

@app.post("/voice-references/upload")
async def upload_voice_reference(
    file: UploadFile = File(...),
    ref_transcript: Optional[str] = Form(None),
):
    """
    Upload and cache a reference voice audio for Qwen3-TTS voice cloning.

    Returns a reference ID that can be used in /talk requests.
    """
    import uuid as _uuid

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".wav", ".mp3", ".m4a", ".ogg", ".flac"}:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {ext}")

    ref_id = str(_uuid.uuid4())
    cache_dir = os.path.join(tempfile.gettempdir(), "manju_voice_refs")
    os.makedirs(cache_dir, exist_ok=True)

    dest_path = os.path.join(cache_dir, f"{ref_id}{ext}")
    with open(dest_path, "wb") as f:
        content = await file.read()
        f.write(content)

    _voice_ref_cache[ref_id] = {
        "path": dest_path,
        "filename": file.filename,
        "ref_transcript": ref_transcript,
        "created_at": datetime.now().isoformat(),
    }

    logger.info("Cached voice reference %s (%s)", ref_id, file.filename)

    return {
        "id": ref_id,
        "filename": file.filename,
        "ref_transcript": ref_transcript,
        "created_at": _voice_ref_cache[ref_id]["created_at"],
    }


@app.get("/voice-references")
async def list_voice_references():
    """List all cached voice references."""
    items = []
    for ref_id, info in _voice_ref_cache.items():
        items.append({
            "id": ref_id,
            "filename": info["filename"],
            "ref_transcript": info.get("ref_transcript"),
            "created_at": info["created_at"],
        })
    return items


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
    """Update the reference transcript for a cached voice reference."""
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


# =============================================================================
# Qwen TTS Service Health & Proxy
# =============================================================================

@app.get("/qwen-tts/health")
async def qwen_tts_health():
    """Health check proxy for Qwen3-TTS service."""
    if http_client is None:
        raise HTTPException(status_code=503, detail="HTTP client not initialized")
    try:
        resp = await http_client.get(f"{QWEN_TTS_URL}/health")
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Qwen TTS unreachable: {e}")


async def _qwen_tts_synthesize(
    text: str,
    mode: str = "custom",
    voice_name: str = "serena",
    instruction: Optional[str] = None,
    voice_description: Optional[str] = None,
    reference_voice_id: Optional[str] = None,
    use_fast_mode: bool = True,
) -> bytes:
    """Internal helper — call Qwen3-TTS service and return audio bytes."""
    if http_client is None:
        raise RuntimeError("HTTP client not initialized")

    if mode == "voice-clone":
        # Need reference audio
        if not reference_voice_id or reference_voice_id not in _voice_ref_cache:
            raise ValueError("Valid reference_voice_id required for voice-clone mode")

        ref_info = _voice_ref_cache[reference_voice_id]
        ref_path = ref_info["path"]
        ref_transcript = ref_info.get("ref_transcript") or ""

        with open(ref_path, "rb") as f:
            files = {"reference_audio": (os.path.basename(ref_path), f, "audio/wav")}
            data = {
                "text": text,
                "ref_transcript": ref_transcript,
                "use_fast_mode": str(use_fast_mode).lower(),
            }
            resp = await http_client.post(
                f"{QWEN_TTS_URL}/qwen-tts/voice-clone",
                data=data,
                files=files,
            )

    elif mode == "voice-design":
        if not voice_description:
            raise ValueError("voice_description required for voice-design mode")
        resp = await http_client.post(
            f"{QWEN_TTS_URL}/qwen-tts/voice-design",
            json={"text": text, "voice_description": voice_description},
        )

    else:
        # Default: custom preset voice
        payload: Dict[str, Any] = {"text": text, "voice_name": voice_name}
        if instruction:
            payload["instruction"] = instruction
        resp = await http_client.post(
            f"{QWEN_TTS_URL}/qwen-tts/custom-voice",
            json=payload,
        )

    if resp.status_code != 200:
        detail = resp.text[:500]
        raise RuntimeError(f"Qwen TTS returned {resp.status_code}: {detail}")

    return resp.content


async def _qwen_tts_synthesize_stream(
    text: str,
    mode: str = "custom",
    voice_name: str = "serena",
    instruction: Optional[str] = None,
    voice_description: Optional[str] = None,
    reference_voice_id: Optional[str] = None,
    use_fast_mode: bool = True,
):
    """Async generator — stream audio chunks from Qwen3-TTS streaming endpoints.

    Yields bytes as they arrive from the TTS service, enabling progressive
    audio delivery to the client (first sentence plays while rest generates).
    Falls back to the non-streaming endpoint if the /stream/ endpoint is
    unavailable (404).
    """
    if http_client is None:
        raise RuntimeError("HTTP client not initialized")

    if mode == "voice-clone":
        if not reference_voice_id or reference_voice_id not in _voice_ref_cache:
            raise ValueError("Valid reference_voice_id required for voice-clone mode")

        ref_info = _voice_ref_cache[reference_voice_id]
        ref_path = ref_info["path"]
        ref_transcript = ref_info.get("ref_transcript") or ""

        # Read reference audio into memory (small file) to avoid file-handle issues
        ref_content = open(ref_path, "rb").read()
        files = {"reference_audio": (os.path.basename(ref_path), ref_content, "audio/wav")}
        data = {
            "text": text,
            "ref_transcript": ref_transcript,
            "use_fast_mode": str(use_fast_mode).lower(),
        }

        try:
            async with http_client.stream(
                "POST",
                f"{QWEN_TTS_URL}/qwen-tts/stream/voice-clone",
                data=data,
                files=files,
                timeout=httpx.Timeout(300.0),
            ) as resp:
                if resp.status_code == 404:
                    # Streaming endpoint not available — fall back
                    logger.warning("Streaming endpoint not found, falling back to non-streaming")
                    audio = await _qwen_tts_synthesize(
                        text, mode, voice_name, instruction,
                        voice_description, reference_voice_id, use_fast_mode)
                    yield audio
                    return
                if resp.status_code != 200:
                    content = await resp.aread()
                    raise RuntimeError(f"Qwen TTS returned {resp.status_code}: {content[:500]}")
                async for chunk in resp.aiter_bytes(chunk_size=16384):
                    yield chunk
        except httpx.ConnectError:
            logger.warning("TTS stream connection failed, falling back")
            audio = await _qwen_tts_synthesize(
                text, mode, voice_name, instruction,
                voice_description, reference_voice_id, use_fast_mode)
            yield audio

    elif mode == "voice-design":
        if not voice_description:
            raise ValueError("voice_description required for voice-design mode")
        try:
            async with http_client.stream(
                "POST",
                f"{QWEN_TTS_URL}/qwen-tts/stream/voice-design",
                json={"text": text, "voice_description": voice_description},
                timeout=httpx.Timeout(300.0),
            ) as resp:
                if resp.status_code == 404:
                    audio = await _qwen_tts_synthesize(
                        text, mode, voice_name, instruction,
                        voice_description, reference_voice_id, use_fast_mode)
                    yield audio
                    return
                if resp.status_code != 200:
                    content = await resp.aread()
                    raise RuntimeError(f"Qwen TTS returned {resp.status_code}: {content[:500]}")
                async for chunk in resp.aiter_bytes(chunk_size=16384):
                    yield chunk
        except httpx.ConnectError:
            audio = await _qwen_tts_synthesize(
                text, mode, voice_name, instruction,
                voice_description, reference_voice_id, use_fast_mode)
            yield audio

    else:
        # Default: custom preset voice
        payload: Dict[str, Any] = {"text": text, "voice_name": voice_name}
        if instruction:
            payload["instruction"] = instruction
        try:
            async with http_client.stream(
                "POST",
                f"{QWEN_TTS_URL}/qwen-tts/stream/custom-voice",
                json=payload,
                timeout=httpx.Timeout(300.0),
            ) as resp:
                if resp.status_code == 404:
                    audio = await _qwen_tts_synthesize(
                        text, mode, voice_name, instruction,
                        voice_description, reference_voice_id, use_fast_mode)
                    yield audio
                    return
                if resp.status_code != 200:
                    content = await resp.aread()
                    raise RuntimeError(f"Qwen TTS returned {resp.status_code}: {content[:500]}")
                async for chunk in resp.aiter_bytes(chunk_size=16384):
                    yield chunk
        except httpx.ConnectError:
            audio = await _qwen_tts_synthesize(
                text, mode, voice_name, instruction,
                voice_description, reference_voice_id, use_fast_mode)
            yield audio


# =============================================================================
# Document Embedding Endpoints
# =============================================================================

class EmbedDocumentsRequest(BaseModel):
    """Request to embed documents from a directory."""
    documents_path: str
    user_id: str
    project_id: str
    embedding_model: Optional[str] = "text-embedding-3-small"
    chunk_size: Optional[int] = 1000
    chunk_overlap: Optional[int] = 200
    openai_api_key: Optional[str] = None


class EmbedDocumentsResponse(BaseModel):
    """Response from document embedding."""
    success: bool
    documents_count: Optional[int] = None
    chunks_count: Optional[int] = None
    index_path: Optional[str] = None
    error: Optional[str] = None


class QueryDocumentsRequest(BaseModel):
    """Request to query embedded documents."""
    query: str
    user_id: str
    project_id: str
    top_k: int = 3


class QueryDocumentsResponse(BaseModel):
    """Response from document query."""
    success: bool
    results: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None


class DeleteIndexRequest(BaseModel):
    """Request to delete a document index."""
    user_id: str
    project_id: str


@app.post("/embed-documents", response_model=EmbedDocumentsResponse)
async def embed_documents(request: EmbedDocumentsRequest):
    """
    Embed documents from a directory into a FAISS vector store.
    
    This endpoint is called by the Go backend after documents are uploaded.
    """
    if embedding_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        result = embedding_service.embed_documents(
            documents_path=request.documents_path,
            user_id=request.user_id,
            project_id=request.project_id,
            embedding_model=request.embedding_model,
            chunk_size=request.chunk_size,
            chunk_overlap=request.chunk_overlap,
            openai_api_key=request.openai_api_key,
        )
        return EmbedDocumentsResponse(**result)
    except Exception as e:
        logger.exception("Error embedding documents")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query-documents", response_model=QueryDocumentsResponse)
async def query_documents(request: QueryDocumentsRequest):
    """
    Query embedded documents for similar content.
    """
    if embedding_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        result = embedding_service.query_documents(
            query=request.query,
            user_id=request.user_id,
            project_id=request.project_id,
            top_k=request.top_k,
        )
        return QueryDocumentsResponse(**result)
    except Exception as e:
        logger.exception("Error querying documents")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/delete-index")
async def delete_index(request: DeleteIndexRequest):
    """
    Delete a FAISS index for a project.
    """
    if embedding_service is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    try:
        result = embedding_service.delete_index(
            user_id=request.user_id,
            project_id=request.project_id,
        )
        return result
    except Exception as e:
        logger.exception("Error deleting index")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("AI_SERVICE_PORT", "8000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
