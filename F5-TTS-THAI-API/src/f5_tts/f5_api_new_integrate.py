from fastapi import APIRouter, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import random
import sys
import tempfile
import torchaudio
import soundfile as sf
from cached_path import cached_path
import os
import json
import uuid
import shutil
from pathlib import Path
import numpy as np

from f5_tts.infer.utils_infer import (
    infer_process,
    load_model,
    load_vocoder,
    preprocess_ref_audio_text,
    remove_silence_for_generated_wav,
    save_spectrogram,
)
from f5_tts.model import DiT
from f5_tts.model.utils import seed_everything
import torch
from f5_tts.cleantext.number_tha import replace_numbers_with_thai
from f5_tts.cleantext.th_repeat import process_thai_repeat
from f5_tts.utils.whisper_api import translate_inference, transribe_inference
from f5_tts.infer.infer_gradio import parse_speechtypes_text, infer
from collections import OrderedDict

# Configuration
default_model_base = "hf://VIZINTZOR/F5-TTS-THAI/model_1000000.pt"
v2_model_base = "hf://VIZINTZOR/F5-TTS-TH-v2/model_250000.pt"
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
vocab_base = os.path.join(ROOT_DIR, "vocab", "vocab.txt")
vocab_ipa_base = os.path.join(ROOT_DIR, "vocab", "vocab_ipa.txt")

# Global variables
f5tts_model = None
vocoder = None
device = None

# Cached reference data for speed optimization
cached_ref_audio = None
cached_ref_text = None
cached_ref_processed = None  # Preprocessed reference data
cached_cleaned_text = {}  # Cache for cleaned text to avoid repeated processing

# Initialize FastAPI router
router = APIRouter(
    tags=["TTS"],
    responses={404: {"description": "Not found"}},
)

# Pydantic models for request/response
class TTSRequest(BaseModel):
    ref_text: str
    gen_text: str
    remove_silence: bool = True
    cross_fade_duration: float = 0.15
    nfe_step: int = 32
    speed: float = 1.0
    cfg_strength: float = 2.0
    max_chars: int = 250
    seed: int = -1
    lang_process: str = "Default"

class TTSResponse(BaseModel):
    success: bool
    audio_file: Optional[str] = None
    spectrogram_file: Optional[str] = None
    ref_text: Optional[str] = None
    seed: Optional[int] = None
    message: Optional[str] = None

class ModelLoadRequest(BaseModel):
    model_choice: str  # "Default", "V2", or "Custom"
    model_custom_path: Optional[str] = None

class ModelLoadResponse(BaseModel):
    success: bool
    message: str

class STTRequest(BaseModel):
    translate: bool = False
    model: str = "large-v3-turbo"
    compute_type: str = "float16"
    target_lg: str = "th"
    source_lg: str = "th"

class STTResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    message: Optional[str] = None

class MultiSpeechType(BaseModel):
    name: str
    ref_text: str

class MultiSpeechRequest(BaseModel):
    gen_text: str
    speech_types: List[MultiSpeechType]
    remove_silence: bool = True
    cross_fade_duration: float = 0.15
    nfe_step: int = 32
    use_ipa: bool = False

class MultiSpeechResponse(BaseModel):
    success: bool
    audio_file: Optional[str] = None
    message: Optional[str] = None

# Utility functions
def load_f5tts(ckpt_path, vocab_path=vocab_base, model_type="v1"):
    if model_type == "v1":
        F5TTS_model_cfg = dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, text_mask_padding=False, conv_layers=4, pe_attn_head=1)
    elif model_type == "v2":
        F5TTS_model_cfg = dict(dim=1024, depth=22, heads=16, ff_mult=2, text_dim=512, text_mask_padding=True, conv_layers=4, pe_attn_head=None)
        vocab_path = vocab_ipa_base
    # Defensive: only keep keys accepted by the DiT constructor to avoid unexpected keyword errors
    try:
        import inspect
        sig = inspect.signature(DiT.__init__)
        allowed = {name for name, p in sig.parameters.items() if name != 'self' and p.kind in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY)}
        filtered_cfg = {k: v for k, v in F5TTS_model_cfg.items() if k in allowed}
        dropped = [k for k in F5TTS_model_cfg.keys() if k not in filtered_cfg]
        if dropped:
            print(f"Dropping unsupported keys from model cfg: {dropped}")
    except Exception:
        filtered_cfg = F5TTS_model_cfg

    model = load_model(DiT, filtered_cfg, ckpt_path, vocab_file=vocab_path, use_ema=True)
    print(f"Loaded model from {ckpt_path}")
    return model

async def save_upload_file(upload_file: UploadFile) -> str:
    """Save uploaded file and return the path"""
    temp_dir = Path("./temp_uploads")
    temp_dir.mkdir(exist_ok=True)
    
    file_extension = Path(upload_file.filename).suffix
    temp_filename = f"{uuid.uuid4()}{file_extension}"
    temp_path = temp_dir / temp_filename
    
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    
    return str(temp_path)

# Startup event to initialize models
@router.on_event("startup")
async def startup_event():
    global f5tts_model, vocoder, device
    try:
        # Set device
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"Using device: {device}")
        
        # Enable cuDNN optimizations for faster convolution
        if device.type == 'cuda':
            torch.backends.cudnn.benchmark = True
            print("cuDNN benchmark enabled for optimized performance")
        
        vocoder = load_vocoder()
        # Move vocoder to device if it's a torch model
        if hasattr(vocoder, 'to'):
            vocoder = vocoder.to(device)
        
        # Diagnostic: print resolved vocab paths and DiT constructor signature
        try:
            import inspect
            from f5_tts.model import DiT as DiTClass

            print("Resolved vocab paths:", vocab_base, vocab_ipa_base)
            try:
                print("DiT module:", DiTClass.__module__)
                print("DiT constructor:", inspect.signature(DiTClass.__init__))
                # Print where the f5_tts package is loaded from and DiT source file
                import f5_tts as _f5
                try:
                    print("f5_tts package file:", getattr(_f5, '__file__', 'unknown'))
                except Exception:
                    pass
                try:
                    print("DiT source file:", inspect.getsourcefile(DiTClass))
                except Exception:
                    pass
            except Exception as e:
                print("Failed to inspect DiT signature:", e)
        except Exception:
            pass

        f5tts_model = load_f5tts(str(cached_path(default_model_base)))
        # Move model to device
        f5tts_model = f5tts_model.to(device)
        print("Models loaded successfully and moved to device")
    except Exception as e:
        print(f"Error loading models: {e}")

# API Endpoints
@router.get("/")
async def root():
    return {"message": "F5-TTS Thai API is running"}

@router.get("/debug/model_info")
async def debug_model_info():
    """Debug endpoint to check model parameters and DiT signature"""
    try:
        import inspect
        from f5_tts.model import DiT
        
        # Get DiT constructor signature
        dit_signature = inspect.signature(DiT.__init__)
        dit_params = list(dit_signature.parameters.keys())
        
        # Check current model status
        model_status = {
            "dit_parameters": dit_params,
            "f5tts_model_loaded": f5tts_model is not None,
            "vocoder_loaded": vocoder is not None,
        }
        
        # Try to get version info
        try:
            import f5_tts
            model_status["f5_tts_version"] = getattr(f5_tts, '__version__', 'unknown')
        except:
            model_status["f5_tts_version"] = "unknown"
            
        return model_status
    except Exception as e:
        return {"error": str(e)}

@router.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "models_loaded": f5tts_model is not None and vocoder is not None,
        "api_version": "1.0.0",
        "reference_cached": cached_ref_processed is not None,
        "device": str(device) if device else "cpu",
        "text_cache_size": len(cached_cleaned_text)
    }

@router.post("/load_model", response_model=ModelLoadResponse)
async def load_custom_model(request: ModelLoadRequest):
    global f5tts_model, device
    try:
        torch.cuda.empty_cache()
        
        if request.model_choice == "Custom":
            if not request.model_custom_path:
                raise HTTPException(status_code=400, detail="Custom model path is required")
            f5tts_model = load_f5tts(str(cached_path(request.model_custom_path)))
            message = f"Loaded Custom Model {request.model_custom_path}"
        else:
            model_path = default_model_base if request.model_choice == "Default" else v2_model_base
            f5tts_model = load_f5tts(
                str(cached_path(model_path)),
                vocab_path=vocab_ipa_base if request.model_choice == "V2" else vocab_base,
                model_type="v2" if request.model_choice == "V2" else "v1"
            )
            message = f"Loaded Model {request.model_choice}"
        
        # Move model to device
        if device is not None:
            f5tts_model = f5tts_model.to(device)
        
        return ModelLoadResponse(success=True, message=message)
    except Exception as e:
        return ModelLoadResponse(success=False, message=f"Error loading model: {str(e)}")

@router.post("/set_reference")
async def set_reference(
    ref_audio: UploadFile = File(...),
    ref_text: str = Form(...)
):
    """Cache reference audio and text for faster TTS generation"""
    global cached_ref_audio, cached_ref_text, cached_ref_processed
    
    try:
        # Save uploaded audio file
        ref_audio_path = await save_upload_file(ref_audio)
        
        # Cache the raw data
        cached_ref_audio = ref_audio_path
        cached_ref_text = ref_text
        
        # Preprocess and cache the processed data
        cached_ref_processed = preprocess_ref_audio_text(ref_audio_path, ref_text)
        
        return {"message": "Reference cached successfully", "ref_text": ref_text}
    except Exception as e:
        return {"error": f"Failed to cache reference: {str(e)}"}

@router.delete("/clear_reference")
async def clear_reference():
    """Clear cached reference data"""
    global cached_ref_audio, cached_ref_text, cached_ref_processed
    
    try:
        # Clean up cached audio file if it exists
        if cached_ref_audio and os.path.exists(cached_ref_audio):
            os.unlink(cached_ref_audio)
        
        # Clear cache
        cached_ref_audio = None
        cached_ref_text = None
        cached_ref_processed = None
        
        return {"message": "Reference cache cleared"}
    except Exception as e:
        return {"error": f"Failed to clear cache: {str(e)}"}

@router.delete("/clear_text_cache")
async def clear_text_cache():
    """Clear cached cleaned text data"""
    global cached_cleaned_text
    
    try:
        cached_cleaned_text.clear()
        return {"message": "Text cache cleared", "previous_size": len(cached_cleaned_text)}
    except Exception as e:
        return {"error": f"Failed to clear text cache: {str(e)}"}

@router.post("/tts", response_model=TTSResponse)
async def text_to_speech(
    ref_audio: UploadFile = File(None),  # Optional: use cached if not provided
    ref_text: str = Form(None),          # Optional: use cached if not provided
    gen_text: str = Form(...),
    remove_silence: bool = Form(True),
    cross_fade_duration: float = Form(0.15),
    nfe_step: int = Form(8),  # Reduced from 16 for faster inference (8-16 recommended)
    speed: float = Form(1.0),
    cfg_strength: float = Form(2.0),
    max_chars: int = Form(250),
    seed: int = Form(-1),
    sway_sampling_coef: float = Form(-1.0),  # Sway Sampling: focuses power on early generation stages
    use_epss: bool = Form(True),  # EPSS: Empirically Pruned Step Sampling for faster inference
    fast_mode: bool = Form(False),  # Enable fast mode: lower quality settings for speed
    return_file: bool = Form(False),
):
    global f5tts_model, vocoder, cached_ref_processed, cached_ref_text
    
    if f5tts_model is None:
        f5tts_model = load_f5tts(str(cached_path(default_model_base)))

    try:
        # Use cached reference if no new one provided
        if ref_audio is None and cached_ref_processed is not None:
            ref_audio_processed, ref_text_processed = cached_ref_processed
            ref_audio_path = cached_ref_audio  # For cleanup
        else:
            # Process new reference
            if ref_audio is None or ref_text is None:
                raise HTTPException(status_code=400, detail="Reference audio and text are required if not cached")
            ref_audio_path = await save_upload_file(ref_audio)
            ref_audio_processed, ref_text_processed = preprocess_ref_audio_text(ref_audio_path, ref_text)
        
        # Move tensors to device
        if device is not None and isinstance(ref_audio_processed, torch.Tensor):
            ref_audio_processed = ref_audio_processed.to(device)
        
        # Set seed
        if seed == -1:
            seed = random.randint(0, sys.maxsize)
        seed_everything(seed)
        
        # Validate inputs
        if not gen_text.strip():
            raise HTTPException(status_code=400, detail="Generated text cannot be empty")
        
        # Clean generated text (with caching)
        if gen_text in cached_cleaned_text:
            gen_text_cleaned = cached_cleaned_text[gen_text]
        else:
            gen_text_cleaned = process_thai_repeat(replace_numbers_with_thai(gen_text))
            cached_cleaned_text[gen_text] = gen_text_cleaned
        
        # Apply fast mode settings
        if fast_mode:
            nfe_step = min(nfe_step, 4)  # Very fast inference
            remove_silence = False  # Skip silence removal for speed
            cfg_strength = min(cfg_strength, 1.5)  # Reduce CFG for speed
        
        # Generate audio with Sway Sampling and EPSS for better quality
        # Performance tips:
        # - Use GPU for significant speedup (automatically enabled)
        # - Lower nfe_step (8-16) for faster inference with slight quality trade-off
        # - Cache reference data to avoid preprocessing
        # - Cache text cleaning for repeated text
        # - Set remove_silence=False for fastest generation
        # - Use fast_mode=True for maximum speed
        # - sway_sampling_coef=-1.0 enables Sway Sampling for better speech structure
        final_wave, final_sample_rate, combined_spectrogram = infer_process(
            ref_audio_processed,
            ref_text_processed,
            gen_text_cleaned,
            f5tts_model,
            vocoder,
            cross_fade_duration=float(cross_fade_duration),
            nfe_step=nfe_step,
            speed=speed,
            cfg_strength=cfg_strength,
            sway_sampling_coef=sway_sampling_coef,
            set_max_chars=max_chars,
        )
        
        # Remove silence if requested
        if remove_silence:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                sf.write(f.name, final_wave, final_sample_rate)
                remove_silence_for_generated_wav(f.name)
                final_wave, _ = torchaudio.load(f.name)
            final_wave = final_wave.squeeze().cpu().numpy()
        
        # Save output audio
        output_dir = Path("./outputs")
        output_dir.mkdir(exist_ok=True)
        output_filename = f"generated_{uuid.uuid4()}.wav"
        output_path = output_dir / output_filename
        
        sf.write(str(output_path), final_wave, final_sample_rate)
        
        # Save spectrogram
        spectrogram_filename = f"spectrogram_{uuid.uuid4()}.jpg"
        spectrogram_path = output_dir / spectrogram_filename
        save_spectrogram(combined_spectrogram, str(spectrogram_path))
        
        # Clean up temporary file (only if not using cached)
        if ref_audio is not None:
            os.unlink(ref_audio_path)

        # If the caller requested the file back directly, stream it
        if return_file:
            # Return the WAV file as attachment
            return FileResponse(path=str(output_path), media_type="audio/wav", filename=output_filename)

        return TTSResponse(
            success=True,
            audio_file=str(output_path),
            spectrogram_file=str(spectrogram_path),
            ref_text=ref_text_processed,
            seed=seed
        )
        
    except Exception as e:
        return TTSResponse(success=False, message=f"TTS generation failed: {str(e)}")

@router.post("/stt", response_model=STTResponse)
async def speech_to_text(
    audio_file: UploadFile = File(...),
    translate: bool = Form(False),
    model: str = Form("large-v3-turbo"),
    compute_type: str = Form("float16"),
    target_lg: str = Form("th"),
    source_lg: str = Form("th")
):
    try:
        # Save uploaded audio file
        audio_path = await save_upload_file(audio_file)
        
        # Perform transcription/translation
        if translate:
            output_text = translate_inference(
                text=transribe_inference(
                    input_audio=audio_path,
                    model=model,
                    compute_type=compute_type,
                    language=source_lg
                ),
                target=target_lg
            )
        else:
            output_text = transribe_inference(
                input_audio=audio_path,
                model=model,
                compute_type=compute_type,
                language=source_lg
            )
        
        # Clean up temporary file
        os.unlink(audio_path)
        
        return STTResponse(success=True, text=output_text)
        
    except Exception as e:
        return STTResponse(success=False, message=f"STT failed: {str(e)}")

@router.post("/multi_speech", response_model=MultiSpeechResponse)
async def multi_speech_generation(
    gen_text: str = Form(...),
    speech_types_json: str = Form(...),
    remove_silence: bool = Form(True),
    cross_fade_duration: float = Form(0.15),
    nfe_step: int = Form(32),
    use_ipa: bool = Form(False),
    audio_files: List[UploadFile] = File(...)
):
    global f5tts_model, vocoder
    
    try:
        # Parse speech types
        speech_types_data = json.loads(speech_types_json)
        
        # Save audio files and create speech types mapping
        speech_types = OrderedDict()
        for i, (speech_type_data, audio_file) in enumerate(zip(speech_types_data, audio_files)):
            audio_path = await save_upload_file(audio_file)
            speech_types[speech_type_data["name"]] = {
                "audio": audio_path,
                "ref_text": speech_type_data["ref_text"]
            }
        
        # Parse the gen_text into segments
        segments = parse_speechtypes_text(gen_text)
        
        # Generate audio for each segment
        generated_audio_segments = []
        current_style = list(speech_types.keys())[0] if speech_types else "Regular"
        
        for segment in segments:
            style = segment["style"]
            text = segment["text"]
            
            if style in speech_types:
                current_style = style
            else:
                print(f"Warning: Type {style} is not available, using {current_style} as default.")
            
            ref_audio = speech_types[current_style]["audio"]
            ref_text = speech_types[current_style].get("ref_text", "")
            
            # Clean text
            ms_cleaned_text = process_thai_repeat(replace_numbers_with_thai(text))
            
            # Generate speech for this segment
            audio_out, _, ref_text_out = infer(
                ref_audio, 
                ref_text, 
                ms_cleaned_text, 
                f5tts_model, 
                vocoder, 
                remove_silence, 
                cross_fade_duration=cross_fade_duration, 
                nfe_step=nfe_step, 
                show_info=print,
                use_ipa=use_ipa,
            )
            
            sr, audio_data = audio_out
            generated_audio_segments.append(audio_data)
            speech_types[current_style]["ref_text"] = ref_text_out
        
        # Concatenate all audio segments
        if generated_audio_segments:
            final_audio_data = np.concatenate(generated_audio_segments)
            
            # Save output audio
            output_dir = Path("./outputs")
            output_dir.mkdir(exist_ok=True)
            output_filename = f"multi_speech_{uuid.uuid4()}.wav"
            output_path = output_dir / output_filename
            
            sf.write(str(output_path), final_audio_data, sr)
            
            # Clean up temporary files
            for speech_type in speech_types.values():
                if os.path.exists(speech_type["audio"]):
                    os.unlink(speech_type["audio"])
            
            return MultiSpeechResponse(success=True, audio_file=str(output_path))
        else:
            return MultiSpeechResponse(success=False, message="No audio generated")
            
    except Exception as e:
        return MultiSpeechResponse(success=False, message=f"Multi-speech generation failed: {str(e)}")

@router.get("/download/{filename}")
async def download_file(filename: str):
    """Download generated audio or spectrogram files"""
    file_path = Path("./outputs") / filename
    if file_path.exists():
        return FileResponse(path=str(file_path), filename=filename)
    else:
        raise HTTPException(status_code=404, detail="File not found")

# Cleanup endpoint to remove old files
@router.delete("/cleanup")
async def cleanup_files():
    """Remove old generated files"""
    try:
        output_dir = Path("./outputs")
        temp_dir = Path("./temp_uploads")
        
        count = 0
        for directory in [output_dir, temp_dir]:
            if directory.exists():
                for file_path in directory.glob("*"):
                    if file_path.is_file():
                        file_path.unlink()
                        count += 1
        
        return {"message": f"Cleaned up {count} files"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

