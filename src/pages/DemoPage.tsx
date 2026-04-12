import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Send, User, Bot, Square,
  Settings, ChevronLeft,
  Volume2, Mic, AlertCircle,
  Loader2, VolumeX, Zap,
  Download, Activity
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { getCachedAudio, setCachedAudio, concatenateWavBlobs } from '../utils/audioCache';
import Navbar from '../components/Navbar';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model_used?: string;
  processing_time_ms?: number;
  asr_time_ms?: number;
  t_ret_ms?: number;
  llm_time_ms?: number;
  t_ttft_ms?: number;
  tts_time_ms?: number;
  t_e2e_ms?: number;
  nodes_executed?: string[];
  audioUrl?: string; // For voice output
  audioCacheKey?: string; // IndexedDB cache key for replaying audio
}

interface TalkResult {
  text_response: string;
  sentences: string[];
  cache_key: string;
  model_used?: string;
  processing_time_ms?: number;
  asr_time_ms?: number;
  t_ret_ms?: number;
  llm_time_ms?: number;
  t_llm_ms?: number;
  t_ttft_ms?: number;
  tts_time_ms?: number;
  t_tts_ms?: number;
  t_e2e_ms?: number;
  nodes_executed?: string[];
  tts_settings: {
    tts_mode: string;
    voice_name: string;
    instruction?: string;
    voice_description?: string;
    reference_voice_id?: string;
    use_fast_mode: boolean;
  };
}

interface Project {
  id: string;
  name: string;
  description: string;
}

interface ValidationResult {
  valid: boolean;
  issues: string[];
  node_count: number;
  connection_count: number;
  node_types: string[];
}

interface WorkflowType {
  input_type: 'text' | 'voice';
  output_type: 'text' | 'voice';
  workflow_type: 'text-to-text' | 'text-to-voice' | 'voice-to-text' | 'voice-to-voice';
  has_rag: boolean;
  has_sheets: boolean;
  has_condition: boolean;
  tts_provider?: 'openai' | 'qwen3';
  asr_provider?: 'web-speech' | 'typhoon';
  asr_language?: string; // e.g. "th", "th-TH", "en", "en-US"
  openai_voice?: string; // e.g. "alloy", "nova" — from voice-output node
  openai_model?: string; // e.g. "tts-1", "gpt-4o-audio-preview"
}

const resolveSpeechLang = (asrLanguage?: string): string => {
  const raw = (asrLanguage || '').trim().toLowerCase();
  if (!raw) return 'th-TH';
  if (raw === 'th') return 'th-TH';
  if (raw === 'en') return 'en-US';
  if (raw === 'ja') return 'ja-JP';
  if (raw === 'zh') return 'zh-CN';
  return asrLanguage || 'th-TH';
};

export default function DemoPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [verbose, setVerbose] = useState(false);
  const [workflowType, setWorkflowType] = useState<WorkflowType | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  // Web Speech API (real-time recognition) state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  // VAD (voice activity detection) refs/state
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadMediaStreamRef = useRef<MediaStream | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const vadSilenceTimerRef = useRef<number | null>(null);
  const vadSpeakingRef = useRef(false);
  const VAD_SILENCE_MS = 1100; // silence duration to auto-send
  const VAD_THRESHOLD = 0.01; // RMS threshold for detecting speech (tweakable)

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputValueRef = useRef('');
  // Keep only finalized Web Speech chunks to avoid relying on async state timing.
  const webSpeechFinalRef = useRef('');
  const interimTranscriptRef = useRef('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isRecordingRef = useRef(false);
  const isRecognizingRef = useRef(false);
  const vadCutoffRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCancelledRef = useRef(false);
  const sendMessageRef = useRef<(() => Promise<void>) | null>(null);
  const lastAsrMsRef = useRef<number | undefined>(undefined);

  const resolveE2E = (message: Message): number | undefined => {
    if (message.t_e2e_ms !== undefined) return message.t_e2e_ms;
    const parts = [message.asr_time_ms, message.t_ret_ms, message.llm_time_ms, message.tts_time_ms]
      .filter((v): v is number => v !== undefined);
    if (parts.length === 0) return undefined;
    return parts.reduce((sum, v) => sum + v, 0);
  };

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  useEffect(() => {
    mediaRecorderRef.current = mediaRecorder;
  }, [mediaRecorder]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isRecognizingRef.current = isRecognizing;
  }, [isRecognizing]);

  // Load project and validate on mount
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) {
        navigate('/projects');
        return;
      }

      try {
        setLoading(true);

        // Load project info
        const projectRes = await apiFetch(`${API_BASE}/api/projects/${projectId}`, {
          credentials: 'include',
        });

        if (!projectRes.ok) {
          if (projectRes.status === 401) {
            navigate('/login');
            return;
          }
          throw new Error('Failed to load project');
        }

        const projectData = await projectRes.json();
        setProject(projectData);

        // Validate workflow and get workflow type in parallel
        const [validateRes, workflowTypeRes] = await Promise.all([
          apiFetch(`${API_BASE}/api/projects/${projectId}/validate`, {
            method: 'POST',
            credentials: 'include',
          }),
          apiFetch(`${API_BASE}/api/projects/${projectId}/workflow-type`, {
            credentials: 'include',
          }),
        ]);

        if (validateRes.ok) {
          const validationData = await validateRes.json();
          setValidation(validationData);
        }

        if (workflowTypeRes.ok) {
          const workflowTypeData = await workflowTypeRes.json();
          setWorkflowType(workflowTypeData);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, navigate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    if (!loading) {
      inputRef.current?.focus();
    }
  }, [loading]);

  // Typhoon ASR: send audio blob to backend for transcription
  const transcribeWithTyphoon = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    const mime = (audioBlob.type || '').toLowerCase();
    const ext = mime.includes('wav')
      ? 'wav'
      : mime.includes('flac')
        ? 'flac'
        : mime.includes('mpeg') || mime.includes('mp3')
          ? 'mp3'
          : mime.includes('ogg')
            ? 'ogg'
            : mime.includes('opus')
              ? 'opus'
              : mime.includes('webm')
                ? 'webm'
                : 'wav';

    console.log('Sending Typhoon ASR audio:', {
      size: audioBlob.size,
      type: audioBlob.type,
      ext,
    });

    if (audioBlob.size > 4.5 * 1024 * 1024) {
      console.warn('Typhoon payload too large:', audioBlob.size);
      return null;
    }

    const formData = new FormData();
    formData.append('file', audioBlob, `recording.${ext}`);

    const asrStart = Date.now();
    setIsTranscribing(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/asr/transcribe`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn(`Typhoon ASR failed (${res.status}): ${err.error || 'Unknown error'}`);
        return null; // Return null to signal failure for fallback
      }

      const data = await res.json();
      const asrMs = Date.now() - asrStart;
      lastAsrMsRef.current = asrMs;
      console.log(`Typhoon ASR took ${asrMs}ms — "${data.text}"`);
      return data.text || '';
    } catch (err) {
      console.warn('Typhoon ASR transcription error:', err);
      return null; // Return null to signal failure for fallback
    } finally {
      setIsTranscribing(false);
    }
  }, [projectId]);

  // Voice recording functions
  const handleVoiceInput = useCallback(async (audioBlob: Blob, sendImmediately = true) => {
    if (!audioBlob || audioBlob.size < 512) {
      setError('Audio capture is too short or empty. Please hold the mic longer and try again.');
      return;
    }

    let transcription: string = '';

    // Try Typhoon ASR if configured, with fallback to Web Speech
    if (workflowType?.asr_provider === 'typhoon') {
      console.log('Attempting Typhoon ASR transcription...');
      const result = await transcribeWithTyphoon(audioBlob);
      if (result && result.trim()) {
        transcription = result;
      } else {
        console.warn('Typhoon ASR failed or returned empty, skipping audio transcription');
      }
    }

    // If no transcription yet, require inputValue from Web Speech or manual entry
    if (!transcription.trim() && !inputValue.trim()) {
      setError('No speech detected or transcription available. Please try again or use text input.');
      return;
    }

    // Use transcription if available, otherwise use inputValue from Web Speech/manual
    const finalText = transcription.trim() || inputValue.trim();
    if (!finalText) return;

    if (!sendImmediately) {
      setInputValue(finalText);
      setError(null);
      return;
    }

    // Create user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: finalText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue(''); // Clear input after sending
    setSending(true);
    setError(null);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const isQwen3Voice =
        workflowType?.output_type === 'voice' && workflowType?.tts_provider === 'qwen3';

      if (isQwen3Voice) {
        // Qwen3 TTS path — workflow → sentences → pipeline playback
        const llmStart = Date.now();
        const talkResult = await callTalkEndpoint(userMessage.content, conversationHistory);
        const llm_time_ms = Date.now() - llmStart;
        if (!talkResult) {
          throw new Error('Failed to get voice response from Qwen3 TTS');
        }

        const assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: talkResult.text_response || '[Voice response]',
          timestamp: new Date(),
          model_used: talkResult.model_used,
          processing_time_ms: talkResult.processing_time_ms,
          asr_time_ms: talkResult.asr_time_ms ?? lastAsrMsRef.current,
          t_ret_ms: talkResult.t_ret_ms,
          llm_time_ms: talkResult.t_llm_ms ?? talkResult.llm_time_ms ?? llm_time_ms,
          t_ttft_ms: talkResult.t_ttft_ms,
          tts_time_ms: talkResult.t_tts_ms ?? talkResult.tts_time_ms,
          t_e2e_ms: talkResult.t_e2e_ms,
          nodes_executed: talkResult.nodes_executed,
          audioCacheKey: talkResult.cache_key,
        };

        setMessages(prev => [...prev, assistantMessage]);
        ttsCancelledRef.current = false;
        setPlayingAudioId(assistantMessage.id);
        const ttsStart = Date.now();
        await playTTSPipeline(talkResult.sentences, talkResult.cache_key, talkResult.tts_settings);
        const tts_time_ms = Date.now() - ttsStart;
        setPlayingAudioId(null);
        if (talkResult.tts_time_ms === undefined) {
          setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, tts_time_ms } : m));
        }
      } else {
        // Standard OpenAI TTS path
        const llmStart = Date.now();
        const res = await apiFetch(`${API_BASE}/api/projects/${projectId}/demo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: userMessage.content,
            conversation_history: conversationHistory,
            session_id: projectId,
            is_voice_input: true,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to get response');
        }

        const data = await res.json();
        const llm_time_ms = Date.now() - llmStart;

        const assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          model_used: data.model_used,
          processing_time_ms: data.processing_time_ms,
          asr_time_ms: data.asr_time_ms ?? lastAsrMsRef.current,
          t_ret_ms: data.t_ret_ms,
          llm_time_ms: data.t_llm_ms ?? data.llm_time_ms ?? llm_time_ms,
          t_ttft_ms: data.t_ttft_ms,
          tts_time_ms: data.t_tts_ms ?? data.tts_time_ms,
          t_e2e_ms: data.t_e2e_ms,
          nodes_executed: data.nodes_executed,
        };

        setMessages(prev => [...prev, assistantMessage]);

        // If voice output, play the audio
        if (workflowType?.output_type === 'voice') {
          setPlayingAudioId(assistantMessage.id);
          speakResponse(data.response, assistantMessage.id);
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setSending(false);
    }
  }, [messages, projectId, workflowType, inputValue]);

  // VAD helpers
  const startVADMonitoring = useCallback(async (stream?: MediaStream) => {
    try {
      const micStream = stream ?? await navigator.mediaDevices.getUserMedia({ audio: true });
      vadMediaStreamRef.current = micStream;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(micStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      vadAnalyserRef.current = analyser;
      vadSpeakingRef.current = false;

      const sample = () => {
        const analyserNode = vadAnalyserRef.current;
        if (!analyserNode) return;
        const buffer = new Float32Array(analyserNode.fftSize);
        analyserNode.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);

        if (rms > VAD_THRESHOLD) {
          // speaking
          vadSpeakingRef.current = true;
          if (vadSilenceTimerRef.current) {
            window.clearTimeout(vadSilenceTimerRef.current);
            vadSilenceTimerRef.current = null;
          }
        } else {
          // not loud
          if (vadSpeakingRef.current) {
            // start silence timer to finalize
            if (!vadSilenceTimerRef.current) {
              vadSilenceTimerRef.current = window.setTimeout(() => {
                // Silence cutoff: commit transcript to input and stop mic.
                const committed = [
                  inputValueRef.current,
                  webSpeechFinalRef.current,
                  interimTranscriptRef.current,
                ].filter(Boolean).join(' ').trim().replace(/\s+/g, ' ');

                if (committed) {
                  setInputValue(committed);
                  setInterimTranscript('');
                  webSpeechFinalRef.current = committed;
                }

                // Stop Web Speech mic path
                if (isRecognizingRef.current && recognitionRef.current) {
                  try {
                    vadCutoffRef.current = true;
                    recognitionRef.current._shouldRestart = false;
                    recognitionRef.current.stop();
                  } catch (err) {
                    console.warn('SpeechRecognition stop on VAD failed', err);
                  }
                  setIsRecognizing(false);
                }

                // Stop Typhoon recording path; onstop will transcribe.
                if (isRecordingRef.current && mediaRecorderRef.current) {
                  try { mediaRecorderRef.current.requestData(); } catch (err) { console.warn('requestData failed', err); }
                  vadCutoffRef.current = true;
                  try { mediaRecorderRef.current.stop(); } catch (err) { console.warn('MediaRecorder stop on VAD failed', err); }
                  setIsRecording(false);
                }

                if (vadRafRef.current) {
                  window.cancelAnimationFrame(vadRafRef.current);
                  vadRafRef.current = null;
                }
                if (vadSilenceTimerRef.current) {
                  window.clearTimeout(vadSilenceTimerRef.current);
                  vadSilenceTimerRef.current = null;
                }
                if (vadAnalyserRef.current) {
                  try { vadAnalyserRef.current.disconnect(); } catch (e) { console.warn(e); }
                  vadAnalyserRef.current = null;
                }
                if (audioContextRef.current) {
                  try { audioContextRef.current.close(); } catch (e) { console.warn(e); }
                  audioContextRef.current = null;
                }
                if (vadMediaStreamRef.current) {
                  try { vadMediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) { console.warn(e); }
                  vadMediaStreamRef.current = null;
                }
                vadSpeakingRef.current = false;
                vadSilenceTimerRef.current = null;
              }, VAD_SILENCE_MS);
            }
          }
        }

        vadRafRef.current = window.requestAnimationFrame(sample);
      };

      vadRafRef.current = window.requestAnimationFrame(sample);
    } catch (err) {
      console.warn('VAD start failed', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [VAD_SILENCE_MS, VAD_THRESHOLD]);

  const stopVADMonitoring = useCallback(() => {
    if (vadRafRef.current) {
      window.cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (vadSilenceTimerRef.current) {
      window.clearTimeout(vadSilenceTimerRef.current);
      vadSilenceTimerRef.current = null;
    }
    if (vadAnalyserRef.current) {
      try { vadAnalyserRef.current.disconnect(); } catch (e) { console.warn(e); }
      vadAnalyserRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) { console.warn(e); }
      audioContextRef.current = null;
    }
    if (vadMediaStreamRef.current) {
      try { vadMediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) { console.warn(e); }
      vadMediaStreamRef.current = null;
    }
    vadSpeakingRef.current = false;
  }, []);

  // Initialize Web Speech API (SpeechRecognition) if available
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recog = new SpeechRecognition();
      recog.continuous = false; // Stop naturally when user stops speaking
      recog.interimResults = true; // Real-time interim results
      // Always respect workflow-configured language first.
      recog.lang = resolveSpeechLang(workflowType?.asr_language);
      recog.maxAlternatives = 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recog.onresult = (ev: any) => {
        let interim = '';
        let finalTranscript = '';
        for (let i = ev.resultIndex; i < ev.results.length; ++i) {
          const res = ev.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        // Append final transcript to the input value and keep interim separately
        if (finalTranscript) {
          const nextFinal = webSpeechFinalRef.current
            ? `${webSpeechFinalRef.current} ${finalTranscript}`.trim()
            : finalTranscript.trim();
          webSpeechFinalRef.current = nextFinal;
          setInputValue(nextFinal);
        }
        setInterimTranscript(interim);
        if (interim) {
          console.log('Web Speech interim:', interim);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recog.onerror = (ev: any) => {
        console.warn('Web Speech error:', ev?.error || ev);
        if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') {
          setError('Microphone permission denied for Web Speech. Please allow mic access in browser settings.');
        } else if (ev?.error === 'no-speech') {
          setError('No speech detected. Please speak closer to the microphone and try again.');
        } else {
          setError(`Web Speech error: ${ev?.error || 'unknown'}`);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recog.onnomatch = (_ev: any) => {
        console.warn('Web Speech: no match');
      };

      recog.onend = () => {
        // If we were still recognizing, restart to keep continuous recognition
        if (recognitionRef.current && recognitionRef.current._shouldRestart) {
          try { recognitionRef.current.start(); } catch (e) { console.warn(e); }
        } else {
          setIsRecognizing(false);
          setInterimTranscript('');
          // stop VAD monitoring when recognition naturally ends
          try { stopVADMonitoring(); } catch (err) { console.warn(err); }
          // Automatically send message if we have accumulated text from Web Speech
          const finalText =
            webSpeechFinalRef.current.trim() ||
            inputValueRef.current.trim() ||
            interimTranscriptRef.current.trim();
          if (finalText && !vadCutoffRef.current) {
            console.log('Web Speech ended with text:', finalText);
            setInputValue(finalText);
            setTimeout(() => {
              if (sendMessageRef.current) {
                void sendMessageRef.current();
              }
            }, 120);
          }
          vadCutoffRef.current = false;
          webSpeechFinalRef.current = '';
        }
      };

      recognitionRef.current = recog;
    } catch (err) {
      console.warn('SpeechRecognition init failed', err);
      recognitionRef.current = null;
    }
  }, [stopVADMonitoring, workflowType?.asr_language]);



  const startRecording = useCallback(async () => {
    const useTyphoon = workflowType?.asr_provider === 'typhoon';
    setError(null);

    // Typhoon mode: always record audio and call backend ASR.
    if (useTyphoon) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        try { await startVADMonitoring(stream); } catch (err) { console.warn('VAD start failed', err); }
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const chosenType = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(chunks, { type: chosenType });
          console.log('Typhoon recorded chunks:', chunks.length, 'blob size:', audioBlob.size, 'type:', chosenType);
          const sendImmediately = !vadCutoffRef.current;
          vadCutoffRef.current = false;
          await handleVoiceInput(audioBlob, sendImmediately);
          stream.getTracks().forEach(track => track.stop());
        };

        setMediaRecorder(recorder);
        recorder.start(250);
        setIsRecording(true);
        console.log('Typhoon recording started (will call ai_backend on stop)');
        return;
      } catch (err) {
        setError('Failed to access microphone. Please allow microphone access.');
        console.error('Microphone error:', err);
        return;
      }
    }

    // Web Speech mode (browser built-in, real-time)
    if (recognitionRef.current) {
      try {
        webSpeechFinalRef.current = '';
        setInputValue('');
        setInterimTranscript('');
        recognitionRef.current._shouldRestart = true;
        recognitionRef.current.start();
        setIsRecognizing(true);
        console.log('Web Speech Recognition started');
        return;
      } catch (err) {
        console.warn('SpeechRecognition start failed:', err);
        setError('Failed to start Web Speech. Trying microphone fallback...');
      }
    }

    setError('Web Speech recognition is not supported in this browser. Use Chrome/Edge or switch ASR provider to Typhoon.');
  }, [handleVoiceInput, startVADMonitoring]);

  const stopRecording = useCallback(() => {
    // Stop Web Speech API recognition if active
    if (recognitionRef.current && isRecognizing) {
      try {
        recognitionRef.current._shouldRestart = false;
        recognitionRef.current.stop();
        console.log('Web Speech stopped, final input value:', inputValue);
      } catch (err) {
        console.warn('SpeechRecognition stop failed', err);
      }
      setIsRecognizing(false);
      setInterimTranscript('');
      try { stopVADMonitoring(); } catch (err) { console.warn(err); }
      return;
    }

    if (mediaRecorder && isRecording) {
      try { mediaRecorder.requestData(); } catch (err) { console.warn('requestData failed', err); }
      mediaRecorder.stop();
      setIsRecording(false);
      try { stopVADMonitoring(); } catch (err) { console.warn(err); }
    }
  }, [mediaRecorder, isRecording, isRecognizing, stopVADMonitoring, inputValue]);

  // Text-to-speech for voice output using backend OpenAI TTS
  const speakResponse = async (text: string, messageId?: string) => {
    try {
      // Cancel any ongoing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const ttsStart = Date.now();
      const res = await apiFetch(`${API_BASE}/api/projects/${projectId}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: text,
          voice: workflowType?.openai_voice || 'alloy',
          model: workflowType?.openai_model || 'tts-1',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate speech');
      }

      const blob = await res.blob();
      const tts_time_ms = Date.now() - ttsStart;

      // Cache the blob and record timing so download + verbose work
      if (messageId) {
        const cacheKey = `openai-tts-${messageId}`;
        await setCachedAudio(cacheKey, blob).catch(() => { });
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, audioCacheKey: cacheKey, tts_time_ms } : m));
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      if (messageId) setPlayingAudioId(messageId);

      audio.onended = () => {
        setPlayingAudioId(null);
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setPlayingAudioId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Qwen3 TTS helpers: sentence-level pipeline with audio caching
  // ---------------------------------------------------------------------------

  /** Call /talk — returns JSON with text + sentences + cache key (no audio). */
  const callTalkEndpoint = async (
    message: string,
    conversationHistory: { role: string; content: string }[],
  ): Promise<TalkResult | null> => {
    try {
      const res = await apiFetch(`${API_BASE}/api/projects/${projectId}/talk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          conversation_history: conversationHistory,
          session_id: projectId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get voice response');
      }

      return await res.json();
    } catch (err) {
      console.error('Qwen TTS /talk error:', err);
      return null;
    }
  };

  /** TTS a single sentence chunk via /qwen-tts/tts-sentence. Returns complete WAV blob. */
  const fetchSentenceTTS = async (
    text: string,
    ttsSettings: TalkResult['tts_settings'],
  ): Promise<Blob> => {
    const res = await apiFetch(`${API_BASE}/api/qwen-tts/tts-sentence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text, ...ttsSettings }),
    });
    if (!res.ok) throw new Error(`TTS sentence failed: ${res.status}`);
    return res.blob();
  };

  /** Play a blob through a standard HTML5 Audio element. Resolves when done. */
  const playBlobAsync = (blob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        reject(new Error('Audio playback error'));
      };
      audio.play().catch(reject);
    });
  };

  /**
   * Sentence-level TTS pipeline with pre-fetching and audio caching.
   *
   * 1. Check IndexedDB cache → if hit, play the cached full audio.
   * 2. If cache miss, TTS each sentence individually:
   *    - Pre-fetch the next sentence while the current one plays.
   *    - User hears sentence 1 while sentence 2 is being generated.
   * 3. After all sentences finish, concatenate WAV blobs and store
   *    in IndexedDB for instant replay.
   */
  const playTTSPipeline = async (
    sentences: string[],
    cacheKey: string,
    ttsSettings: TalkResult['tts_settings'],
  ): Promise<void> => {
    // --- Cache hit: instant replay ---
    try {
      const cached = await getCachedAudio(cacheKey);
      if (cached) {
        await playBlobAsync(cached);
        return;
      }
    } catch { /* cache read failed, continue */ }

    if (sentences.length === 0) return;

    // --- Cache miss: sentence pipeline ---
    const blobs: Blob[] = [];
    const promises: (Promise<Blob> | null)[] = new Array(sentences.length).fill(null);

    // Kick off first 2 sentences in parallel
    promises[0] = fetchSentenceTTS(sentences[0], ttsSettings);
    if (sentences.length > 1) {
      promises[1] = fetchSentenceTTS(sentences[1], ttsSettings);
    }

    for (let i = 0; i < sentences.length; i++) {
      if (ttsCancelledRef.current) break;

      // Wait for this sentence's audio
      const blob = await promises[i]!;
      blobs.push(blob);

      // Pre-fetch next-next sentence while we play current
      if (i + 2 < sentences.length) {
        promises[i + 2] = fetchSentenceTTS(sentences[i + 2], ttsSettings);
      }

      if (ttsCancelledRef.current) break;

      // Play this sentence (standard Audio element — reliable, no alien sounds)
      await playBlobAsync(blob);
    }

    // --- Concatenate and cache for future replay ---
    if (!ttsCancelledRef.current && blobs.length > 0) {
      try {
        const fullBlob = await concatenateWavBlobs(blobs);
        await setCachedAudio(cacheKey, fullBlob);
      } catch (e) {
        console.warn('Failed to cache concatenated audio:', e);
      }
    }
  };

  /**
   * Play cached audio for a message, or re-synthesise via text-to-voice
   * as a fallback (single call, no workflow re-run).
   */
  const playFromCacheOrTTS = async (message: Message): Promise<void> => {
    // 1. Try IndexedDB cache
    if (message.audioCacheKey) {
      try {
        const cached = await getCachedAudio(message.audioCacheKey);
        if (cached) {
          await playBlobAsync(cached);
          return;
        }
      } catch { /* ignore */ }
    }

    // 2. Fallback: re-TTS via text-to-voice (no workflow re-run)
    const formData = new FormData();
    formData.append('text', message.content);
    const res = await apiFetch(`${API_BASE}/api/qwen-tts/text-to-voice`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) throw new Error('Qwen3 TTS failed');
    const blob = await res.blob();

    // Store in cache for next time
    if (message.audioCacheKey) {
      await setCachedAudio(message.audioCacheKey, blob).catch(() => { });
    }
    await playBlobAsync(blob);
  };

  const stopSpeaking = () => {
    ttsCancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingAudioId(null);
  };

  /** Download cached audio for a message as a WAV file. */
  const downloadAudio = async (message: Message) => {
    let blob: Blob | null = null;

    if (message.audioCacheKey) {
      try {
        blob = await getCachedAudio(message.audioCacheKey);
      } catch { /* ignore */ }
    }

    // Fallback: re-fetch from the appropriate TTS endpoint
    if (!blob) {
      try {
        if (workflowType?.tts_provider === 'qwen3') {
          const fd = new FormData();
          fd.append('text', message.content);
          const res = await apiFetch(`${API_BASE}/api/qwen-tts/text-to-voice`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
          });
          if (res.ok) blob = await res.blob();
        } else {
          const res = await apiFetch(`${API_BASE}/api/projects/${projectId}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              text: message.content,
              voice: workflowType?.openai_voice || 'alloy',
              model: workflowType?.openai_model || 'tts-1',
            }),
          });
          if (res.ok) blob = await res.blob();
        }
      } catch { /* ignore */ }
    }

    if (!blob) return;

    const ext = workflowType?.tts_provider === 'qwen3' ? 'wav' : 'mp3';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-output-${message.id}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || sending) return;
    lastAsrMsRef.current = undefined;

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setSending(true);
    setError(null);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const isQwen3Voice =
        workflowType?.output_type === 'voice' && workflowType?.tts_provider === 'qwen3';

      if (isQwen3Voice) {
        // ---- Qwen3 TTS path: /talk → JSON, then sentence pipeline ----
        const llmStart = Date.now();
        const talkResult = await callTalkEndpoint(userMessage.content, conversationHistory);
        const llm_time_ms = Date.now() - llmStart;

        if (!talkResult) {
          throw new Error('Failed to get voice response from Qwen3 TTS');
        }

        const assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: talkResult.text_response || '[Voice response]',
          timestamp: new Date(),
          model_used: talkResult.model_used,
          processing_time_ms: talkResult.processing_time_ms,
          asr_time_ms: talkResult.asr_time_ms,
          t_ret_ms: talkResult.t_ret_ms,
          llm_time_ms: talkResult.t_llm_ms ?? talkResult.llm_time_ms ?? llm_time_ms,
          t_ttft_ms: talkResult.t_ttft_ms,
          tts_time_ms: talkResult.t_tts_ms ?? talkResult.tts_time_ms,
          t_e2e_ms: talkResult.t_e2e_ms,
          nodes_executed: talkResult.nodes_executed,
          audioCacheKey: talkResult.cache_key,
        };

        setMessages(prev => [...prev, assistantMessage]);
        ttsCancelledRef.current = false;
        setPlayingAudioId(assistantMessage.id);
        const ttsStart = Date.now();
        await playTTSPipeline(talkResult.sentences, talkResult.cache_key, talkResult.tts_settings);
        const tts_time_ms = Date.now() - ttsStart;
        setPlayingAudioId(null);
        if (talkResult.tts_time_ms === undefined) {
          setMessages(prev => prev.map(m => m.id === assistantMessage.id ? { ...m, tts_time_ms } : m));
        }
      } else {
        // ---- Standard path: /demo for text, then optionally OpenAI TTS ----
        const llmStart = Date.now();
        const res = await apiFetch(`${API_BASE}/api/projects/${projectId}/demo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: userMessage.content,
            conversation_history: conversationHistory,
            session_id: projectId,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to get response');
        }

        const data = await res.json();
        const llm_time_ms = Date.now() - llmStart;

        const assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          model_used: data.model_used,
          processing_time_ms: data.processing_time_ms,
          asr_time_ms: data.asr_time_ms,
          t_ret_ms: data.t_ret_ms,
          llm_time_ms: data.t_llm_ms ?? data.llm_time_ms ?? llm_time_ms,
          t_ttft_ms: data.t_ttft_ms,
          tts_time_ms: data.t_tts_ms ?? data.tts_time_ms,
          t_e2e_ms: data.t_e2e_ms,
          nodes_executed: data.nodes_executed,
        };

        setMessages(prev => [...prev, assistantMessage]);

        // If voice output workflow (OpenAI TTS), automatically speak the response
        if (workflowType?.output_type === 'voice') {
          setPlayingAudioId(assistantMessage.id);
          speakResponse(data.response, assistantMessage.id);
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      // Remove the user message if we failed
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
      setInputValue(userMessage.content); // Restore input
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [inputValue, messages, projectId, workflowType, sending]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading demo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 pt-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/model-config/${projectId}`)}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Back to Editor</span>
            </button>
            <div className="h-6 w-px bg-gray-200" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {project?.name || 'Demo'}
              </h1>
              <p className="text-xs text-gray-500">Test your workflow</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setVerbose(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${verbose ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              title="Toggle verbose execution info"
            >
              <Activity className="w-4 h-4" />
              Verbose
            </button>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`p-2 rounded-lg transition-colors ${showDebug ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              title="Toggle debug info"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={clearChat}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear Chat
            </button>
          </div>
        </div>
      </header>

      {/* Validation Warning */}
      {validation && !validation.valid && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Workflow has issues</p>
              <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
                {validation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Info */}
      {showDebug && validation && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-4">
          <div className="bg-gray-100 rounded-lg p-4 text-sm">
            <p className="font-medium text-gray-700 mb-2">Workflow Info</p>
            <div className="grid grid-cols-3 gap-4 text-gray-600">
              <div>
                <span className="font-medium">Nodes:</span> {validation.node_count}
              </div>
              <div>
                <span className="font-medium">Connections:</span> {validation.connection_count}
              </div>
              <div>
                <span className="font-medium">Types:</span> {validation.node_types.join(', ') || 'None'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 overflow-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Zap className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Test Your Workflow
            </h2>
            <p className="text-gray-500 max-w-md">
              Send a message to test your AI workflow. The response will be generated
              based on your workflow configuration.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-purple-600" />
                  </div>
                )}

                <div className={`max-w-[75%] ${message.role === 'user' ? 'order-1' : ''}`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 ${message.role === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                      }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* Voice output controls for assistant messages */}
                    {message.role === 'assistant' && workflowType?.output_type === 'voice' && (
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => {
                            if (playingAudioId === message.id) {
                              stopSpeaking();
                            } else {
                              setPlayingAudioId(message.id);
                              if (workflowType?.tts_provider === 'qwen3') {
                                (async () => {
                                  try {
                                    stopSpeaking();
                                    ttsCancelledRef.current = false;
                                    setPlayingAudioId(message.id);
                                    await playFromCacheOrTTS(message);
                                    setPlayingAudioId(null);
                                  } catch (err) {
                                    console.error('Qwen3 replay error:', err);
                                    setPlayingAudioId(null);
                                  }
                                })();
                              } else {
                                speakResponse(message.content, message.id);
                              }
                            }
                          }}
                          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors"
                        >
                          {playingAudioId === message.id ? (
                            <><VolumeX className="w-4 h-4" />Stop</>
                          ) : (
                            <><Volume2 className="w-4 h-4" />Play audio</>
                          )}
                        </button>

                        {/* Download voice output */}
                        <button
                          onClick={() => downloadAudio(message)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                          title="Download audio"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Verbose execution info (shown when verbose is ON) */}
                  {verbose && message.role === 'assistant' && (
                    <div className="mt-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg text-xs space-y-1">
                      <div className="font-semibold text-green-700 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Execution Details
                      </div>
                      {message.model_used && (
                        <div className="text-gray-600">
                          <span className="font-medium">Model:</span> {message.model_used}
                        </div>
                      )}
                      {(resolveE2E(message) !== undefined || message.processing_time_ms !== undefined) && (
                        <div className="text-gray-600">
                          <span className="font-medium">Time (E2E):</span>{' '}
                          <span className="text-green-700 font-semibold">
                            {(resolveE2E(message) ?? message.processing_time_ms ?? 0).toFixed(1)} ms
                          </span>
                        </div>
                      )}
                      {message.asr_time_ms !== undefined && (
                        <div className="text-gray-600">
                          <span className="font-medium">Time (ASR):</span>{' '}
                          <span className="text-blue-700 font-semibold">{message.asr_time_ms.toFixed(0)} ms</span>
                        </div>
                      )}
                      {message.t_ret_ms !== undefined && (
                        <div className="text-gray-600">
                          <span className="font-medium">Time (Retriever):</span>{' '}
                          <span className="text-emerald-700 font-semibold">{message.t_ret_ms.toFixed(0)} ms</span>
                        </div>
                      )}
                      {message.llm_time_ms !== undefined && (
                        <div className="text-gray-600">
                          <span className="font-medium">Time (LLM):</span>{' '}
                          <span className="text-purple-700 font-semibold">{message.llm_time_ms.toFixed(0)} ms</span>
                        </div>
                      )}
                      {message.t_ttft_ms !== undefined && (
                        <div className="text-gray-600">
                          <span className="font-medium">Time to First Token (TTFT):</span>{' '}
                          <span className="text-fuchsia-700 font-semibold">{message.t_ttft_ms.toFixed(0)} ms</span>
                        </div>
                      )}
                      {message.tts_time_ms !== undefined && (
                        <div className="text-gray-600">
                          <span className="font-medium">Time (TTS):</span>{' '}
                          <span className="text-orange-700 font-semibold">{message.tts_time_ms.toFixed(0)} ms</span>
                        </div>
                      )}
                      {message.nodes_executed && message.nodes_executed.length > 0 && (
                        <div className="text-gray-600">
                          <span className="font-medium">Nodes:</span>{' '}
                          {message.nodes_executed.map((n, i) => (
                            <span key={i}>
                              <span className="inline-block px-1.5 py-0.5 bg-white border border-green-200 rounded text-[10px]">{n}</span>
                              {i < message.nodes_executed!.length - 1 && <span className="mx-1 text-green-400">→</span>}
                            </span>
                          ))}
                        </div>
                      )}
                      {workflowType?.input_type === 'voice' && (
                        <div className="text-gray-600">
                          <span className="font-medium">ASR provider:</span>{' '}
                          {workflowType.asr_provider === 'typhoon' ? 'Typhoon ASR' : 'Web Speech API'}
                        </div>
                      )}
                      {workflowType?.output_type === 'voice' && (
                        <div className="text-gray-600">
                          <span className="font-medium">TTS provider:</span>{' '}
                          {workflowType.tts_provider === 'qwen3' ? 'Qwen3-TTS' : 'OpenAI TTS'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Debug info (shown when debug/settings is ON) */}
                  {showDebug && message.role === 'assistant' && !verbose && (
                    <div className="mt-1 text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                      {message.model_used && (
                        <span>Model: {message.model_used}</span>
                      )}
                      {message.processing_time_ms && (
                        <span>• {message.processing_time_ms.toFixed(0)}ms</span>
                      )}
                      {message.nodes_executed && message.nodes_executed.length > 0 && (
                        <span>• Nodes: {message.nodes_executed.join(' → ')}</span>
                      )}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0 order-2">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                )}
              </motion.div>
            ))}

            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 justify-start"
              >
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-purple-600" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                    <span className="text-gray-500">Thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Error */}
      {error && (
        <div className="max-w-4xl mx-auto w-full px-4 pb-2">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-700 text-sm">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <footer className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          {/* Workflow Type Indicator */}
          {workflowType && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className={`px-2 py-0.5 text-xs rounded-full ${workflowType.input_type === 'voice'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
                }`}>
                {workflowType.input_type === 'voice'
                  ? `🎤 Voice Input (${workflowType.asr_provider === 'typhoon' ? 'Typhoon' : 'Web Speech'})`
                  : '⌨️ Text Input'}
              </span>
              <span className="text-gray-400">→</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${workflowType.output_type === 'voice'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
                }`}>
                {workflowType.output_type === 'voice'
                  ? `🔊 Voice Output (${workflowType.tts_provider === 'qwen3' ? 'Qwen3' : 'OpenAI'})`
                  : '💬 Text Output'}
              </span>
            </div>
          )}

          {/* Voice Input Mode */}
          {workflowType?.input_type === 'voice' ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={(isRecognizing || isRecording) ? stopRecording : startRecording}
                  disabled={sending || isTranscribing}
                  className={`p-6 rounded-full transition-all ${(isRecognizing || isRecording)
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : 'bg-purple-600 hover:bg-purple-700'
                    } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {sending || isTranscribing ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (isRecognizing || isRecording) ? (
                    <Square className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </motion.button>

                <button
                  onClick={() => { setInputValue(''); setInterimTranscript(''); }}
                  className="px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm"
                >
                  Clear
                </button>
              </div>

              <p className="text-sm text-gray-500">
                {isTranscribing
                  ? 'Transcribing audio... Please wait'
                  : (isRecognizing || isRecording)
                    ? 'Recording... Click to stop'
                    : 'Click to start recording'}
              </p>

              {/* Interim transcript (live) */}
              {interimTranscript && (
                <div className="text-sm text-gray-500 italic">{interimTranscript}</div>
              )}

              {/* Also allow text input as fallback */}
              <div className="w-full flex items-center gap-3 mt-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Or type your message..."
                  disabled={sending || isRecording || isTranscribing}
                  className="flex-1 px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-gray-800 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                />
                <motion.button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || sending || isRecording || isTranscribing}
                  className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          ) : (
            /* Text Input Mode (default) */
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                disabled={sending}
                className="flex-1 px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
              />
              <motion.button
                onClick={sendMessage}
                disabled={!inputValue.trim() || sending}
                className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </motion.button>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2 text-center">
            {workflowType?.input_type === 'voice'
              ? 'Speak or type your message • Your workflow runs on each message'
              : 'Press Enter to send • Your workflow runs on each message'
            }
          </p>
        </div>
      </footer>
    </div>
  );
}
